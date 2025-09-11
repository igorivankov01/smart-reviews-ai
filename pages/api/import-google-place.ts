// pages/api/import-google-place.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabasePublic } from '../../lib/supabasePublic'
import { fetchPlace, GPlace } from '../../lib/google-places'
import { buildActorKey, getClientIp, rateLimit } from '../../lib/rate-limit'
import { getUserIdFromRequest } from '../../lib/auth-server'
import { getUserPlanLimits } from '../../lib/user-plan'

type ApiOk = {
  hotel_id: string
  inserted_reviews: number
  updated_hotel: boolean
  source: { google_place_id: string }
}
type ApiErr = { error: string }

const GOOGLE_KEY_ENV = process.env.GOOGLE_MAPS_API_KEY
if (!GOOGLE_KEY_ENV) throw new Error('Missing GOOGLE_MAPS_API_KEY in environment')
const GOOGLE_KEY: string = GOOGLE_KEY_ENV

async function findHotelByPlaceId(placeId: string): Promise<string | null> {
  const { data, error } = await supabasePublic
    .from('hotels')
    .select('id')
    .eq('source->>google_place_id', placeId)
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(error.message)
  return data?.id ?? null
}

async function upsertHotelFromPlace(p: GPlace, existingId?: string | null): Promise<{ id: string; updated: boolean }> {
  const payload = {
    name: p.name,
    location: p.formattedAddress ?? null,
    image_url: p.photoUrl ?? null,
    source: { google_place_id: p.placeId },
    updated_at: new Date().toISOString(),
  }

  if (existingId) {
    const { error } = await supabasePublic.from('hotels').update(payload).eq('id', existingId)
    if (error) throw new Error(error.message)
    return { id: existingId, updated: true }
  }

  const { data, error } = await supabasePublic.from('hotels').insert(payload).select('id').single<{ id: string }>()
  if (error) throw new Error(error.message)
  return { id: data.id, updated: false }
}

/** Вставляем отзывы с UPSERT на (hotel_id, review_hash) — см. SQL */
async function upsertReviews(hotelId: string, p: GPlace): Promise<number> {
  if (p.reviews.length === 0) return 0

  const rows = p.reviews.slice(0, 200).map((r) => ({
    hotel_id: hotelId,
    text: r.text,
    rating: typeof r.rating === 'number' ? r.rating : null,
    lang: r.lang ?? null,
    created_at: r.timeIso ?? new Date().toISOString(),
  }))

  const { data, error } = await supabasePublic
    .from('reviews')
    .upsert(rows, { onConflict: 'hotel_id,review_hash', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  try {
    const userId = await getUserIdFromRequest(req)
    if (!userId) return res.status(401).json({ error: 'Sign-in required' })

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const placeIdRaw = (req.query.place_id ?? (req.body as { place_id?: unknown } | undefined)?.place_id) as unknown
    const placeId = typeof placeIdRaw === 'string' ? placeIdRaw.trim() : ''
    if (!placeId) return res.status(400).json({ error: 'place_id is required' })

    const limits = await getUserPlanLimits(userId)
    const actorKey = buildActorKey(userId, getClientIp(req))
    const rl = await rateLimit('/api/import-google-place', actorKey, limits.importPlace)
    if (!rl.allowed) return res.status(429).json({ error: 'Rate limit exceeded' })

    const place = await fetchPlace(placeId, GOOGLE_KEY)
    const existingId = await findHotelByPlaceId(place.placeId)
    const { id: hotelId, updated } = await upsertHotelFromPlace(place, existingId)

    const inserted = await upsertReviews(hotelId, place)

    return res.status(200).json({
      hotel_id: hotelId,
      inserted_reviews: inserted,
      updated_hotel: updated,
      source: { google_place_id: place.placeId },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    return res.status(500).json({ error: msg })
  }
}
