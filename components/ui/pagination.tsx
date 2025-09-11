// components/ui/pagination.tsx
import type { MouseEvent } from 'react'

type Props = {
  page: number
  pageCount: number
  onChange: (nextPage: number) => void
}

export default function Pagination({ page, pageCount, onChange }: Props) {
  const canPrev = page > 1
  const canNext = page < pageCount

  const go = (next: number) => () => onChange(next)

  // компактная полоска номеров: текущая ±2
  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pageCount, page + 2)
  for (let p = start; p <= end; p += 1) pages.push(p)

  const handleClickNumber = (p: number) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (p !== page) onChange(p)
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button className="btn btn-outline h-9 px-3 disabled:opacity-50" onClick={go(page - 1)} disabled={!canPrev}>
        Назад
      </button>

      {start > 1 && (
        <>
          <button className="btn h-9 px-3" onClick={handleClickNumber(1)}>1</button>
          {start > 2 && <span className="px-1 text-muted-foreground">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={handleClickNumber(p)}
          className={`h-9 px-3 rounded-2xl border ${p === page ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
        >
          {p}
        </button>
      ))}

      {end < pageCount && (
        <>
          {end < pageCount - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <button className="btn h-9 px-3" onClick={handleClickNumber(pageCount)}>{pageCount}</button>
        </>
      )}

      <button className="btn btn-outline h-9 px-3 disabled:opacity-50" onClick={go(page + 1)} disabled={!canNext}>
        Вперёд
      </button>
    </div>
  )
}
