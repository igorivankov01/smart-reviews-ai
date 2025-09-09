import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Button from '../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'


interface Review { id: string; text: string; rating?: number; lang?: string; created_at?: string }
interface Summary { pros: string[]; cons: string[]; sentiment: 'positive' | 'neutral' | 'negative'; topics: string[] }


export default function HotelPage() {
const router = useRouter()
const { id } = router.query
const [loading, setLoading] = useState(true)
const [analyzing, setAnalyzing] = useState(false)
const [reviews, setReviews] = useState<Review[]>([])
const [summary, setSummary] = useState<Summary | null>(null)


useEffect(() => {
if (!id) return
;(async () => {
try {
setLoading(true)
const res = await fetch(`/api/getReviews?hotel_id=${id}`)
const data = await res.json()
setReviews(data?.data ?? [])
const sum = await fetch(`/api/analyzeReviews?hotel_id=${id}`)
const sdata = await sum.json()
setSummary(sdata?.data ?? null)
} finally {
setLoading(false)
}
})()
}, [id])


const onReanalyze = async () => {
if (!id) return
setAnalyzing(true)
try {
const sum = await fetch(`/api/analyzeReviews?hotel_id=${id}`, { method: 'POST' })
const sdata = await sum.json()
setSummary(sdata?.data ?? null)
} finally {
setAnalyzing(false)
}
}


return (
<section className="container py-8">
{/* Заголовок */}
<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
<div>
<h1 className="text-2xl font-semibold tracking-tight">Отель #{id}</h1>
<p className="text-muted-foreground">AI‑резюме по отзывам гостей</p>
</div>
<div className="flex gap-2">
<Button onClick={onReanalyze} disabled={analyzing}>
{analyzing ? 'Анализ…' : 'Пересчитать' }
</Button>
<Button variant="outline">Поделиться</Button>
</div>
</div>


{/* Top‑cards */}
<div className="mt-6 grid gap-5 md:grid-cols-3">
{loading ? (
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
{summary?.pros?.length ? summary.pros.map((p, i) => <li key={i}>{p}</li>) : <li className="text-muted-foreground">Нет данных</li>}
</ul>
</CardContent>
</Card>
<Card>
<CardHeader title="Минусы" />
<CardContent>
<ul className="list-disc pl-5 space-y-1">
{summary?.cons?.length ? summary.cons.map((c, i) => <li key={i}>{c}</li>) : <li className="text-muted-foreground">Нет данных</li>}
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
<div
className="h-full rounded-full bg-accent transition-all"
style={{ width: summary?.sentiment === 'positive' ? '80%' : summary?.sentiment === 'neutral' ? '50%' : summary?.sentiment === 'negative' ? '25%' : '0%' }}
/>
</div>
<div className="mt-3 text-sm text-muted-foreground">Темы: {summary?.topics?.join(', ') || '—'}</div>
</CardContent>
</Card>
</>
)}
</div>


{/* Список отзывов */}
<div className="mt-8">
<h2 className="text-lg font-semibold mb-3">Отзывы</h2>
<div className="grid gap-4">
{loading ? (
Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
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


{/* Пагинация-место */}
<div className="mt-6 flex items-center justify-center gap-2">
<Button variant="outline">Назад</Button>
<Button>Вперёд</Button>
</div>
</div>
</section>
)
}