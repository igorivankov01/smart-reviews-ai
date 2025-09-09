import { useState } from 'react'
import Link from 'next/link'
import HotelCard from '../components/hotel/hotel-card'
import HotelCardSkeleton from '../components/hotel/hotel-card-skeleton'

type HotelListItem = {
  id: string
  name: string
  location: string | null
  image_url: string | null
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [hotels, setHotels] = useState<HotelListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/search-hotels?q=${encodeURIComponent(q)}`)
      const j = await r.json()
      if (j?.error) throw new Error(j.error)
      setHotels(j?.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setHotels([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          AI-выжимка отзывов об отелях
        </h1>
        <p className="mt-3 text-muted-foreground">
          Введи название отеля — получишь плюсы/минусы, тональность и частые проблемы.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="например, The Edge Bali"
            className="h-12 w-full rounded-2xl border bg-card px-4 outline-none focus:ring-4 focus:ring-primary/20"
            aria-label="Поиск отеля"
          />
          <button
            className="btn btn-primary h-12 px-6"
            onClick={onSearch}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Поиск…' : 'Поиск'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        {/* подсказки/фичи */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Источник</div>
            <div className="mt-1 font-semibold">Supabase + кеш</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Сохраняем отзывы и экономим токены на повторных запросах.
            </p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Аналитика</div>
            <div className="mt-1 font-semibold">OpenAI-резюме</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Плюсы, минусы, тон и часто встречающиеся темы.
            </p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm text-muted-foreground">Скоро</div>
            <div className="mt-1 font-semibold">Google / Tripadvisor / Booking</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Подключим источники и автоматическую агрегацию.
            </p>
          </div>
        </div>

        {/* CTA в футер хедера */}
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>Нужна подписка?</span>
          <Link href="/pricing" className="text-foreground underline-offset-4 hover:underline">
            Посмотреть тарифы
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
          <p className="text-muted-foreground">Ничего не найдено. Попробуй другое название.</p>
        )}
      </div>
    </section>
  )
}
