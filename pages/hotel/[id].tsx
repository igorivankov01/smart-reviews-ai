// pages/hotel/[id].tsx
import { useEffect, useMemo, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import Pagination from '../../components/ui/pagination'
import { supabasePublic } from '../../lib/supabasePublic'
import { supabaseBrowser } from '../../lib/supabase-browser'
import Link from 'next/link'

type Sentiment = 'positive' | 'neutral' | 'negative'

type Review = {
  id: string
  text: string
  rating: number | null
  lang: string | null
  created_at: string | null
}

type Summary = {
  pros: string[]
  cons: string[]
  sentiment: Sentiment
  topics: string[]
  model: string
}

type SummaryRow = {
  pros: string[] | null
  cons: string[] | null
  topics: string[] | null
  sentiment: Sentiment | null
  model: string | null
  updated_at?: string | null
}

type ReviewsResponse = {
  data: Review[]
  page: number
  limit: number
  total: number
  pageCount: number
}

type SummaryResponse =
  | { data: Summary; cached: boolean; updated_at?: string; plan?: 'free' | 'pro' }
  | { error: string }

type Props = {
  hotelId: string
  initialSummary: Summary | null
  initialUpdatedAt: string | null
}

export default function HotelPage({ hotelId, initialSummary, initialUpdatedAt }: Props) {
  // токен — если пользователь есть, будет добавлен к запросам. Если нет — работаем как гость.
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

  // пагинация и язык
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [lang, setLang] = useState<string | undefined>(undefined)
  const [languages, setLanguages] = useState<string[]>([])

  // отзывы
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [reviews, setReviews] = useState<Review[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)

  // сводка
  const [loadingSummary, setLoadingSummary] = useState(!initialSummary)
  const [analyzing, setAnalyzing] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(initialSummary)
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialUpdatedAt ?? undefined)
  const [authRequired, setAuthRequired] = useState(false)

  // загрузка отзывов
  useEffect(() => {
    if (!hotelId) return
    setLoadingReviews(true)
    const params = new URLSearchParams({ hotel_id: hotelId, page: String(page), limit: String(limit) })
    if (lang) params.set('lang', lang)
    fetch(`/api/getReviews?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => r.json())
      .then((j: ReviewsResponse | { error: string }) => {
        if ('error' in j) throw new Error(j.error)
        setReviews(j.data)
        setPageCount(j.pageCount)
        setTotal(j.total)

        const setLangs = new Set<string>()
        j.data.forEach((rev) => {
          if (rev.lang && rev.lang.trim().length > 0) setLangs.add(rev.lang)
        })
        setLanguages(Array.from(setLangs).sort())
      })
      .catch(() => {
        setReviews([])
        setPageCount(1)
        setTotal(0)
        setLanguages([])
      })
      .finally(() => setLoadingReviews(false))
  }, [hotelId, page, limit, lang, token])

  // если сводки нет — пробуем подтянуть (гость получит 2/месяц)
  useEffect(() => {
    if (!hotelId) return
    if (initialSummary) return
    setLoadingSummary(true)
    fetch(`/api/analyzeReviews?hotel_id=${encodeURIComponent(hotelId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then(async (r) => {
        if (r.status === 401) {
          setAuthRequired(true)
          return { error: 'auth-required' }
        }
        return r.json()
      })
      .then((j: SummaryResponse | { error: string }) => {
        if ('error' in j) return
        setSummary(j.data)
        setUpdatedAt(j.updated_at)
      })
      .finally(() => setLoadingSummary(false))
  }, [hotelId, token, initialSummary])

  const onReanalyze = async () => {
    if (!hotelId) return
    setAnalyzing(true)
    try {
      const r = await fetch(`/api/analyzeReviews?hotel_id=${encodeURIComponent(hotelId)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (r.status === 401) {
        setAuthRequired(true)
        return
      }
      const j: SummaryResponse = await r.json()
      if ('data' in j) {
        setSummary(j.data)
        setUpdatedAt(j.updated_at)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const sentimentWidth = useMemo(() => {
    if (!summary) return '0%'
    if (summary.sentiment === 'positive') return '80%'
    if (summary.sentiment === 'neutral') return '50%'
    return '25%'
  }, [summary])

  return (
    <section className="container py-8">
      {/* Баннер: бесплатные попытки закончились */}
      {authRequired && (
        <div className="mb-4 rounded-2xl border bg-card p-4">
          <div className="font-semibold">Бесплатный лимит исчерпан</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Войдите, чтобы продолжить анализ и открыть больше возможностей.
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/sign-in" className="btn h-10 px-4">Войти</Link>
            <Link href="/pricing" className="btn btn-outline h-10 px-4">Тарифы</Link>
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отель #{hotelId}</h1>
          <p className="text-muted-foreground">
            AI-резюме по отзывам гостей {updatedAt ? <span>· обновлено {new Date(updatedAt).toLocaleString()}</span> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn h-10 px-4" onClick={onReanalyze} disabled={analyzing}>
            {analyzing ? 'Анализ…' : 'Пересчитать'}
          </button>
          <button className="btn btn-outline h-10 px-4" onClick={() => navigator.share?.({ url: location.href })}>
            Поделиться
          </button>
        </div>
      </div>

      {/* Сводка */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {loadingSummary ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader title="Плюсы" />
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {summary?.pros?.length ? summary.pros.map((p, i) => <li key={i}>{p}</li>) : (
                    <li className="text-muted-foreground">Нет данных</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Минусы" />
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {summary?.cons?.length ? summary.cons.map((c, i) => <li key={i}>{c}</li>) : (
                    <li className="text-muted-foreground">Нет данных</li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Тональность" />
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Общая оценка</span>
                  <span className="font-semibold capitalize">{summary?.sentiment ?? '—'}</span>
                </div>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: sentimentWidth }} />
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  Темы: {summary?.topics?.join(', ') || '—'}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Панель фильтра языка */}
      <div className="mt-8 flex items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="lang-select">Язык отзывов</label>
        <select
          id="lang-select"
          value={lang ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setLang(v || undefined)
            setPage(1)
          }}
          className="h-10 rounded-2xl border bg-card px-3 outline-none focus:ring-4 focus:ring-primary/20"
        >
          <option value="">Все</option>
          {languages.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">· всего {total}</span>
      </div>

      {/* Отзывы */}
      <div className="mt-4">
        <div className="grid gap-4">
          {loadingReviews ? (
            Array.from({ length: limit }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : reviews.length ? (
            reviews.map((r) => (
              <Card key={r.id} className="card-hover">
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{r.lang?.toUpperCase() || '—'}</span>
                    <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="mt-2 leading-relaxed">{r.text}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">Пока нет отзывов</p>
          )}
        </div>

        {/* Пагинация */}
        {!loadingReviews && reviews.length > 0 && pageCount > 1 && (
          <div className="mt-6">
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Страница {page} из {pageCount} · всего {total}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const idParam = ctx.params?.id
  const hotelId = typeof idParam === 'string' ? idParam : ''
  if (!hotelId) return { notFound: true }

  const { data } = await supabasePublic
    .from('summaries')
    .select('pros,cons,topics,sentiment,model,updated_at')
    .eq('hotel_id', hotelId)
    .maybeSingle<SummaryRow>()

  const initialSummary: Summary | null = data
    ? {
        pros: data.pros ?? [],
        cons: data.cons ?? [],
        topics: data.topics ?? [],
        sentiment: data.sentiment ?? 'neutral',
        model: data.model ?? 'openai',
      }
    : null

  const initialUpdatedAt = data?.updated_at ?? null

  return { props: { hotelId, initialSummary, initialUpdatedAt } }
}
