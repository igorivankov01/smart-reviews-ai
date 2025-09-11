// lib/google-places.ts
export type GReview = {
  text: string
  rating?: number
  lang?: string
  timeIso?: string
}

export type GPlace = {
  name: string
  formattedAddress?: string
  photoUrl?: string
  placeId: string
  reviews: GReview[]
}

/**
 * Фотки в Places приходят как photo_reference. Генерируем прямой URL для загрузки.
 */
function buildPhotoUrl(photoRef: string, apiKey: string, maxWidth = 1600): string {
  const base = 'https://maps.googleapis.com/maps/api/place/photo'
  const qs = new URLSearchParams({
    maxwidth: String(maxWidth),
    photo_reference: photoRef,
    key: apiKey,
  })
  return `${base}?${qs.toString()}`
}

/**
 * Парсим legacy Place Details (stable endpoint).
 * https://maps.googleapis.com/maps/api/place/details/json?place_id=...&fields=...&key=...
 */
export async function fetchPlaceDetailsLegacy(placeId: string, apiKey: string): Promise<GPlace> {
  const endpoint = 'https://maps.googleapis.com/maps/api/place/details/json'
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'photos',
    'reviews', // user_ratings_total/geometry не нужны для MVP
  ].join(',')

  const url = `${endpoint}?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Google Places legacy request failed: ${resp.status}`)

  type LegacyPhoto = { photo_reference: string }
  type LegacyReview = {
    text?: string
    rating?: number
    language?: string
    time?: number // unix seconds
  }
  type LegacyResult = {
    result?: {
      place_id?: string
      name?: string
      formatted_address?: string
      photos?: LegacyPhoto[]
      reviews?: LegacyReview[]
    }
    status?: string
    error_message?: string
  }

  const data = (await resp.json()) as LegacyResult
  if (data.status && data.status !== 'OK') {
    throw new Error(`Google Places error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`)
  }
  const r = data.result
  if (!r || !r.place_id || !r.name) {
    throw new Error('Invalid Google Places response: missing name/place_id')
  }

  const photoRef = Array.isArray(r.photos) && r.photos.length > 0 ? r.photos[0].photo_reference : undefined
  const photoUrl = photoRef ? buildPhotoUrl(photoRef, apiKey) : undefined

  const reviews: GReview[] = Array.isArray(r.reviews)
    ? r.reviews
        .filter((rev) => (rev.text ?? '').trim().length > 0)
        .map((rev) => ({
          text: String(rev.text),
          rating: typeof rev.rating === 'number' ? rev.rating : undefined,
          lang: rev.language ? String(rev.language) : undefined,
          timeIso: typeof rev.time === 'number' ? new Date(rev.time * 1000).toISOString() : undefined,
        }))
    : []

  return {
    name: r.name,
    formattedAddress: r.formatted_address,
    photoUrl,
    placeId: r.place_id,
    reviews,
  }
}

/**
 * Высокоуровневая функция — сейчас используем legacy endpoint.
 * При желании можно добавить пробу «нового» v1 API как fallback/primary.
 */
export async function fetchPlace(placeId: string, apiKey: string): Promise<GPlace> {
  return fetchPlaceDetailsLegacy(placeId, apiKey)
}
