// pages/api/analyzeReviews.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabasePublic } from '../../lib/supabasePublic'

type Sentiment = 'positive' | 'neutral' | 'negative'

type Summary = {
  pros: string[]
  cons: string[]
  sentiment: Sentiment
  topics: string[]
  model: string
}

type SummaryRow = {
  hotel_id: string
  sentiment: Sentiment | null
  pros: string[] | null
  cons: string[] | null
  topics: string[] | null
  model: string | null
  updated_at?: string | null
}

type Review = {
  id: string
  text: string
  rating: number | null
  lang: string | null
  created_at: string | null
}

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OUTPUT_LANG = process.env.OUTPUT_LANG ?? 'ru'
const TTL_HOURS = Number(process.env.ANALYSIS_TTL_HOURS ?? 24)

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  // Явная ошибка в рантайме, чтобы не было тихих падений
  // (TS не требует non-null assertion)
  throw new Error('Missing OPENAI_API_KEY in environment')
}

const openai = new OpenAI({ apiKey })

function hoursSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / (1000 * 60 * 60)
}

function clampRating(value: number | undefined): number {
  const v = typeof value === 'number' ? value : 0
  return Math.max(0, Math.min(5, v))
}

function toStringArray(u: unknown): string[] | null {
  if (!Array.isArray(u)) return null
  // Приводим всё к строкам без any
  return u.map((v) => (typeof v === 'string' ? v : String(v)))
}

function isSentiment(u: unknown): u is Sentiment {
  return u === 'positive' || u === 'neutral' || u === 'negative'
}

function sanitizeSummaryLike(obj: unknown): Summary | null {
  if (typeof obj !== 'object' || obj === null) return null
  const rec = obj as Record<string, unknown>

  const pros = toStringArray(rec.pros) ?? []
  const cons = toStringArray(rec.cons) ?? []
  const topics = toStringArray(rec.topics) ?? []
  const sentiment: Sentiment = isSentiment(rec.sentiment) ? rec.sentiment : 'neutral'

  return { pros, cons, topics, sentiment, model: MODEL }
}

function extractJson(content: string): unknown {
  // иногда модель присылает ```json ... ```
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = m ? m[1] : content
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function fetchCached(hotelId: string): Promise<SummaryRow | null> {
  const { data, error } = await supabasePublic
    .from('summaries')
    .select('*')
    .eq('hotel_id', hotelId)
    .maybeSingle<SummaryRow>()

  if (error) throw new Error(error.message)
  return data ?? null
}

async function fetchReviews(hotelId: string, limit = 200): Promise<Review[]> {
  const { data, error } = await supabasePublic
    .from('reviews')
    .select('id,text,rating,lang,created_at')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<Review[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

function buildPrompt(reviews: Review[]) {
  const sample = reviews
    .map((r) => {
      const date = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : ''
      return `- ${r.text}${date ? ` (${date})` : ''}`
    })
    .join('\n')

  const user = [
    `Ниже отзывы гостей об одном отеле.`,
    `Сделай короткую выжимку на языке: ${OUTPUT_LANG}.`,
    `Верни строго валидный JSON (без префиксов/суффиксов/объяснений):`,
    `{"pros": string[], "cons": string[], "sentiment": "positive|neutral|negative", "topics": string[]}`,
    ``,
    `Отзывы:`,
    sample || '- (нет отзывов)',
  ].join('\n')

  return [
    {
      role: 'system' as const,
      content:
        'Ты ассистент, который кратко суммирует отзывы об отеле. Пиши лаконично, без повторов. Верни валидный JSON.',
    },
    { role: 'user' as const, content: user },
  ]
}

async function analyzeWithOpenAI(reviews: Review[]): Promise<Summary> {
  const messages = buildPrompt(reviews)
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages,
  })
  const content = completion.choices[0]?.message?.content ?? ''
  const parsed = sanitizeSummaryLike(extractJson(content))
  if (parsed) return parsed
  // fallback — пустая выжимка, если JSON не распарсился (редко)
  return { pros: [], cons: [], topics: [], sentiment: 'neutral', model: MODEL }
}

async function upsertSummary(hotelId: string, s: Summary): Promise<void> {
  const row: SummaryRow = {
    hotel_id: hotelId,
    sentiment: s.sentiment,
    pros: s.pros,
    cons: s.cons,
    topics: s.topics,
    model: s.model,
  }
  const { error } = await supabasePublic.from('summaries').upsert(row, { onConflict: 'hotel_id' })
  if (error) throw new Error(error.message)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const hotelIdRaw = (req.query.hotel_id ?? req.body?.hotel_id) as unknown
    const hotelId = typeof hotelIdRaw === 'string' ? hotelIdRaw.trim() : ''
    if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' })

    const isForce = req.method === 'POST' || String(req.query.force ?? '').toLowerCase() === '1'

    // 1) Кеш (если не форс)
    if (!isForce) {
      const cached = await fetchCached(hotelId)
      if (cached?.updated_at && hoursSince(cached.updated_at) < TTL_HOURS) {
        const data: Summary = {
          pros: cached.pros ?? [],
          cons: cached.cons ?? [],
          topics: cached.topics ?? [],
          sentiment: cached.sentiment ?? 'neutral',
          model: cached.model ?? MODEL,
        }
        return res.status(200).json({ data, cached: true, updated_at: cached.updated_at })
      }
    }

    // 2) Свежие отзывы
    const reviews = await fetchReviews(hotelId, 200).then((arr) =>
      arr.map((r) => ({ ...r, rating: clampRating(r.rating ?? undefined) }))
    )

    if (reviews.length === 0) {
      const cached = await fetchCached(hotelId)
      if (cached) {
        const data: Summary = {
          pros: cached.pros ?? [],
          cons: cached.cons ?? [],
          topics: cached.topics ?? [],
          sentiment: cached.sentiment ?? 'neutral',
          model: cached.model ?? MODEL,
        }
        return res.status(200).json({ data, cached: true, updated_at: cached.updated_at })
      }
      return res.status(404).json({ error: 'No reviews for this hotel_id' })
    }

    // 3) Анализ OpenAI
    const summary = await analyzeWithOpenAI(reviews)

    // 4) Сохранить кеш
    await upsertSummary(hotelId, summary)

    return res.status(200).json({ data: summary, cached: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return res.status(500).json({ error: message })
  }
}

// Подсказка по .env.local:
// OPENAI_API_KEY=sk-...              // обязателен
// OPENAI_MODEL=gpt-4o-mini           // опционально
// ANALYSIS_TTL_HOURS=24              // опционально
// OUTPUT_LANG=ru                     // опционально
