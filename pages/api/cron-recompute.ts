// pages/api/cron-recompute.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabasePublic } from '../../lib/supabasePublic'

type Sentiment = 'positive' | 'neutral' | 'negative'
type Review = { id: string; text: string; rating: number | null; lang: string | null; created_at: string | null }
type Summary = { pros: string[]; cons: string[]; topics: string[]; sentiment: Sentiment; model: string }

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const TTL_HOURS = Number(process.env.ANALYSIS_TTL_HOURS ?? 24)
const CRON_SECRET = process.env.CRON_SECRET
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
const openai = new OpenAI({ apiKey })

function hoursSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / (1000 * 60 * 60)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const limitBatch = Math.max(1, Math.min(20, Number(req.query.limit ?? 5)))

  // 1) Найдём отели с отсутствующей или устаревшей сводкой
  const { data: rows, error } = await supabasePublic
    .from('summaries')
    .select('hotel_id, updated_at')
    .limit(2000)

  if (error) return res.status(500).json({ error: error.message })

  const staleIds: string[] = []
  for (const r of rows ?? []) {
    if (!r.updated_at || hoursSince(r.updated_at) >= TTL_HOURS) staleIds.push(r.hotel_id)
  }

  // также подберём отели без сводки (если есть)
  const { data: hotelsNoSummary } = await supabasePublic
    .from('hotels')
    .select('id')
    .not('id', 'in', `(${(rows ?? []).map((r) => `'${r.hotel_id}'`).join(',') || 'null'})`)
    .limit(1000)

  const candidates = [...staleIds, ...((hotelsNoSummary ?? []).map((h) => h.id))]
    .slice(0, limitBatch)

  const processed: string[] = []
  for (const hotelId of candidates) {
    // 2) Тянем свежие отзывы
    const { data: revs } = await supabasePublic
      .from('reviews')
      .select('id,text,rating,lang,created_at')
      .eq('hotel_id', hotelId)
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<Review[]>()

    if (!revs || revs.length === 0) continue

    // 3) Анализ
    const messages = [
      { role: 'system' as const, content: 'Кратко суммируй отзывы об отеле. Верни валидный JSON.' },
      { role: 'user' as const, content: `Отзывы:\n${revs.map((r) => `- ${r.text}`).join('\n')}` },
    ]
    const completion = await openai.chat.completions.create({ model: MODEL, temperature: 0.2, messages })
    const content = completion.choices[0]?.message?.content ?? '{}'
    let summary: Summary
    try {
      // минимальный парсер
      const obj = JSON.parse(content.replace(/```json|```/g, ''))
      summary = {
        pros: Array.isArray(obj.pros) ? obj.pros.map(String) : [],
        cons: Array.isArray(obj.cons) ? obj.cons.map(String) : [],
        topics: Array.isArray(obj.topics) ? obj.topics.map(String) : [],
        sentiment: ['positive', 'neutral', 'negative'].includes(obj.sentiment) ? obj.sentiment : 'neutral',
        model: MODEL,
      }
    } catch {
      summary = { pros: [], cons: [], topics: [], sentiment: 'neutral', model: MODEL }
    }

    await supabasePublic.from('summaries').upsert(
      {
        hotel_id: hotelId,
        pros: summary.pros,
        cons: summary.cons,
        topics: summary.topics,
        sentiment: summary.sentiment as Summary['sentiment'],
        model: summary.model,
      },
      { onConflict: 'hotel_id' }
    )
    processed.push(hotelId)
  }

  return res.status(200).json({ processed })
}
