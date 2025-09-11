// pages/api/analyzeReviews.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { supabasePublic } from '../../lib/supabasePublic'
import { buildActorKey, getClientIp, rateLimit, rateLimitMonthly } from '../../lib/rate-limit'
import { getUserIdFromRequest } from '../../lib/auth-server'
import { getUserPlanLimits } from '../../lib/user-plan'

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
type Review = { id: string; text: string; rating: number | null; lang: string | null; created_at: string | null }
type ApiResponse = {
  data?: Summary
  cached?: boolean
  updated_at?: string
  error?: string
  remaining?: number
  plan?: 'free' | 'pro'
}

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OUTPUT_LANG = process.env.OUTPUT_LANG ?? 'ru'
const TTL_HOURS = Number(process.env.ANALYSIS_TTL_HOURS ?? 24)
const FREE_UNAUTH_ANALYZE_PER_MONTH = Number(process.env.FREE_UNAUTH_ANALYZE_PER_MONTH ?? 2)

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('Missing OPENAI_API_KEY in environment')
const openai = new OpenAI({ apiKey })

function hoursSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / (1000 * 60 * 60)
}
function toStringArray(u: unknown): string[] | null {
  if (!Array.isArray(u)) return null
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
function buildMessages(reviews: Review[]) {
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
    { role: 'system' as const, content: 'Ты ассистент, который кратко суммирует отзывы об отеле. Пиши лаконично.' },
    { role: 'user' as const, content: user },
  ]
}
async function analyzeWithOpenAI(reviews: Review[]): Promise<Summary> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: buildMessages(reviews),
  })
  const content = completion.choices[0]?.message?.content ?? ''
  const parsed = sanitizeSummaryLike(extractJson(content))
  if (parsed) return parsed
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  try {
    const hotelIdRaw = (req.query.hotel_id ?? (req.body as { hotel_id?: unknown } | undefined)?.hotel_id) as unknown
    const hotelId = typeof hotelIdRaw === 'string' ? hotelIdRaw.trim() : ''
    if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' })

    const userId = await getUserIdFromRequest(req)
    const ip = getClientIp(req)
    const actorKey = buildActorKey(userId ?? null, ip)
    const isForce = req.method === 'POST' || String(req.query.force ?? '').toLowerCase() === '1'

    // 1) Сначала пробуем кэш (чтобы не списывать бесплатные попытки)
    if (!isForce) {
      const cached = await fetchCached(hotelId)
      if (cached?.updated_at && hoursSince(cached.updated_at) < TTL_HOURS) {
        const updatedAt: string | undefined = cached.updated_at ?? undefined
        const data: Summary = {
          pros: cached.pros ?? [],
          cons: cached.cons ?? [],
          topics: cached.topics ?? [],
          sentiment: cached.sentiment ?? 'neutral',
          model: cached.model ?? MODEL,
        }
        // Уточним план, если пользователь авторизован
        const plan = userId ? (await getUserPlanLimits(userId)).plan : undefined
        return res.status(200).json({ data, cached: true, updated_at: updatedAt, plan })
      }
    }

    // 2) Применяем лимиты
    if (userId) {
      // Авторизованные — по дневному лимиту их плана
      const limits = await getUserPlanLimits(userId)
      const rl = await rateLimit('/api/analyzeReviews', actorKey, limits.analyze)
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Rate limit exceeded', remaining: rl.remaining, plan: limits.plan })
      }
    } else {
      // Неавторизованные — 2/месяц по IP (по умолчанию)
      const rl = await rateLimitMonthly('/api/analyzeReviews', actorKey, FREE_UNAUTH_ANALYZE_PER_MONTH)
      if (!rl.allowed) {
        return res.status(401).json({ error: 'Free monthly quota exceeded. Please sign in to continue.' })
      }
    }

    // 3) Собираем данные и анализируем
    const reviews = await fetchReviews(hotelId, 200)
    if (reviews.length === 0) return res.status(404).json({ error: 'No reviews for this hotel_id' })

    const summary = await analyzeWithOpenAI(reviews)
    await upsertSummary(hotelId, summary)

    const plan = userId ? (await getUserPlanLimits(userId)).plan : undefined
    return res.status(200).json({ data: summary, cached: false, plan })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error'
    return res.status(500).json({ error: message })
  }
}

// .env.local (новая переменная)
// FREE_UNAUTH_ANALYZE_PER_MONTH=2
