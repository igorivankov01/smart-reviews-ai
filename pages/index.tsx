import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import HotelCard from '../components/hotel/hotel-card'
import HotelCardSkeleton from '../components/hotel/hotel-card-skeleton'
import { supabaseBrowser } from '../lib/supabase-browser'

type HotelListItem = {
  id: string
  name: string
  location: string | null
  image_url: string | null
}

type ImportOk = {
  hotel_id: string
  inserted_reviews: number
  updated_hotel: boolean
  source: { google_place_id: string }
}
type ImportErr = { error: string }

export default function Home() {
  const router = useRouter()

  // токен (для персонификации лимитов на сервере)
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setToken(data.session?.access_token ?? null)
    })
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
      setToken(session?.access_token ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Поиск по названию
  const [query, setQuery] = useState('')
  const [hotels, setHotels] = useState<HotelListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Импорт по Google Place ID (опционально)
  const [placeId, setPlaceId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function onSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/search-hotels?q=${encodeURIComponent(q)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const j = (await r.json()) as { data?: HotelListItem[]; error?: string }
      if (j?.error) throw new Error(j.error)
      setHotels(j?.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setHotels([])
    } finally {
      setLoading(false)
    }
  }

  async function onImport() {
    const pid = placeId.trim()
    if (!pid) return
    setImporting(true)
    setImportError(null)
    try {
      const r = await fetch(`/api/import-google-place`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ place_id: pid }),
      })
      const j = (await r.json()) as ImportOk | ImportErr
      if ('error' in j) throw new Error(j.error)
      await router.push(`/hotel/${j.hotel_id}`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="container py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          AI summaries of restaurant reviews
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter a restaurant name to get pros/cons, sentiment, and frequent issues.
        </p>

        {/* Поиск по названию */}
        <div className="mt-6 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="e.g., Nusantara Bistro"
            className="h-12 w-full rounded-2xl border bg-card px-4 outline-none focus:ring-4 focus:ring-primary/20"
            aria-label="Search restaurant"
          />
          <button
            className="btn btn-primary h-12 px-6"
            onClick={onSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {/* Импорт по Google Place ID (если используешь) */}
        <div className="mt-6 rounded-2xl border p-4 text-left">
          <div className="text-sm text-muted-foreground">Import from Google</div>
          <div className="mt-1 font-semibold">Add a cafe by Google Place ID</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Вставь <b>place_id</b> — we will fetch the restaurant card and initial diner reviews.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onImport()}
              placeholder="например, ChIJN1t_tDeuEmsRUsoyG83frY4"
              className="h-11 w-full rounded-2xl border bg-card px-4 outline-none focus:ring-4 focus:ring-primary/20"
              aria-label="Google Place ID"
            />
            <button
              className="btn h-11 px-5"
              onClick={onImport}
              disabled={importing || !placeId.trim()}
              title="Importing the cafe and first reviews"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
          {importError && <p className="mt-2 text-sm text-danger">{importError}</p>}
        </div>

        {/* Tips */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Source</div>
            <div className="mt-1 font-semibold">Supabase + cache</div>
            <p className="mt-2 text-sm text-muted-foreground">
              We store reviews and cache results to save tokens.
            </p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Аналитика</div>
            <div className="mt-1 font-semibold">OpenAI-резюме</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Pros, cons, sentiment, and recurring topics from diner reviews.
            </p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Скоро</div>
            <div className="mt-1 font-semibold">Google / Booking</div>
            <p className="mt-2 text-sm text-muted-foreground">
              We will connect sources and automatic aggregation for restaurants.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>Need a plan?</span>
          <Link href="/pricing" className="text-foreground underline-offset-4 hover:underline">
            View pricing
          </Link>
        </div>
      </div>

      {/* Результаты поиска */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <HotelCardSkeleton key={i} />)
          : hotels.map((h) => (
              <HotelCard
                key={h.id}
                id={h.id}
                name={h.name}
                location={h.location ?? ''}
                imageUrl={h.image_url ?? undefined}
                href={`/hotel/${h.id}`}
              />
            ))}

        {!loading && hotels.length === 0 && query.trim() && !error && (
          <p className="text-muted-foreground">No results. Try another name.</p>
        )}
      </div>
    </section>
  )
}
