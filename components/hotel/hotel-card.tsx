import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Card, CardContent } from '../ui/card'

export type HotelCardProps = {
  id: string
  name: string
  location?: string
  rating?: number // 0..5
  reviewsCount?: number
  priceFrom?: string // например, "$120"
  imageUrl?: string
  badges?: string[] // ["Чисто", "Тихо", "Рядом с пляжем"]
  href?: string // если хотим линковать на внешнюю страницу отеля
}

function Stars({ value = 0 }: { value?: number }) {
  const v = Math.max(0, Math.min(5, value ?? 0))
  const full = Math.floor(v)
  const half = v - full >= 0.5
  const total = 5
  return (
    <div className="flex items-center gap-1" aria-label={`Rating: ${v} out of 5`}>
      {Array.from({ length: total }).map((_, i) => {
        const isFull = i < full
        const isHalf = !isFull && i === full && half
        return (
          <span
            key={i}
            className={
              'inline-block h-[18px] w-[18px] [clip-path:polygon(50%_0%,_61%_35%,_98%_35%,_68%_57%,_79%_91%,_50%_70%,_21%_91%,_32%_57%,_2%_35%,_39%_35%)] ' +
              (isFull ? 'bg-primary' : isHalf ? 'bg-gradient-to-r from-primary to-border' : 'bg-border')
            }
          />
        )
      })}
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xl bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  )
}

export default function HotelCard({
  id,
  name,
  location,
  rating = 0,
  reviewsCount,
  priceFrom,
  imageUrl,
  badges = [],
  href,
}: HotelCardProps) {
  return (
    <Card className="card-hover overflow-hidden">
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[220px_1fr]">
        {/* Фото */}
        <div className="relative aspect-[4/3] sm:h-[180px]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(min-width: 640px) 220px, 100vw"
              className="object-cover"
              /* priority // включай ТОЛЬКО для первой карточки в вьюпорте */
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              No photo
            </div>
          )}
        </div>

        {/* Контент */}
        <CardContent>
          <div className="flex flex-col gap-3">
            {/* Заголовок + локация */}
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {name}
                  </Link>
                ) : (
                  <span>{name}</span>
                )}
              </h3>
              {location && <div className="mt-0.5 text-sm text-muted-foreground">{location}</div>}
            </div>

            {/* Рейтинг + кол-во отзывов */}
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={rating} />
              <span className="text-sm text-muted-foreground">
                {rating ? rating.toFixed(1) : '—'} · {reviewsCount ?? 0} reviews
              </span>
            </div>

            {/* Бейджи */}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {badges.slice(0, 5).map((b, i) => (
                  <Badge key={i}>{b}</Badge>
                ))}
                {badges.length > 5 && <Badge>+{badges.length - 5}</Badge>}
              </div>
            )}

            {/* Цена + CTA */}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {priceFrom ? (
                  <>
                    from <span className="font-semibold text-foreground">{priceFrom}</span> / night
                  </>
                ) : (
                  <span>Ask for price</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {href && (
                  <Link href={href} className="btn h-9">
                    More
                  </Link>
                )}
                <Link href={`/hotel/${id}`} className="btn btn-outline h-9">
                  AI-summary
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
