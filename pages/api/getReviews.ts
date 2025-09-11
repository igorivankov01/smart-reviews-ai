// pages/api/getReviews.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabasePublic } from '../../lib/supabasePublic'
import { buildActorKey, getClientIp, rateLimit } from '../../lib/rate-limit'
import { getUserIdFromRequest } from '../../lib/auth-server'

type Review = {
  id: string
  text: string
  rating: number | null
  lang: string | null
  created_at: string | null
}

type ReviewsResponse = {
  data: Review[]
  page: number
  limit: number
  total: number
  pageCount: number
  remaining?: number
}

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN
  return Number.isFinite(n) ? n : fallback
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReviewsResponse | { error: string; remaining?: number }>
) {
  const hotelIdRaw = req.query.hotel_id
  const hotelId = typeof hotelIdRaw === 'string' ? hotelIdRaw.trim() : ''
  if (!hotelId) return res.status(400).json({ error: 'hotel_id is required' })

  const userId = await getUserIdFromRequest(req)
  const actorKey = buildActorKey(userId, getClientIp(req))
  const limitPerDay = Number(process.env.FREE_REVIEWS_LIMIT ?? 500)
  const rl = await rateLimit('/api/getReviews', actorKey, limitPerDay)
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded', remaining: rl.remaining })

  const page = Math.max(1, toInt(req.query.page, 1))
  const limitUnsafe = Math.max(1, toInt(req.query.limit, 10))
  const limit = Math.min(50, limitUnsafe)
  const langQ = typeof req.query.lang === 'string' ? req.query.lang.trim() : ''
  const lang = langQ.length > 0 ? langQ : undefined

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabasePublic
    .from('reviews')
    .select('id,text,rating,lang,created_at', { count: 'exact' })
    .eq('hotel_id', hotelId)

  if (lang) query = query.eq('lang', lang)

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) return res.status(500).json({ error: error.message, remaining: rl.remaining })

  const total = count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return res.status(200).json({
    data: (data as Review[]) ?? [],
    page,
    limit,
    total,
    pageCount,
    remaining: rl.remaining,
  })
}
