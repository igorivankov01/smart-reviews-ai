// pages/pricing.tsx
import Link from 'next/link'

export default function PricingPage() {
  return (
    <section className="container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Тарифы</h1>
        <p className="mt-3 text-muted-foreground">
          Начни бесплатно. Для активного использования — подписка.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="card card-hover p-6">
          <div className="text-sm text-muted-foreground">План</div>
          <h2 className="mt-1 text-2xl font-semibold">Free</h2>
          <p className="mt-2 text-muted-foreground">
            Для теста и редких проверок.
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            <li>• До <b>{process.env.NEXT_PUBLIC_FREE_ANALYZE_LIMIT ?? '3'}</b> AI-анализов/день</li>
            <li>• До <b>{process.env.NEXT_PUBLIC_FREE_REVIEWS_LIMIT ?? '500'}</b> просмотров отзывов/день</li>
            <li>• Кэширование результатов</li>
            <li>• Обновление тональности раз в 24 часа</li>
          </ul>

          <div className="mt-6">
            <Link href="/" className="btn btn-outline h-11 px-6">Остаться на Free</Link>
          </div>
        </div>

        {/* Pro */}
        <div className="card card-hover p-6">
          <div className="text-sm text-muted-foreground">План</div>
          <h2 className="mt-1 text-2xl font-semibold">Pro</h2>
          <p className="mt-2 text-muted-foreground">
            Для регулярного мониторинга и ресёрча.
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            <li>• До <b>100</b> AI-анализов/день</li>
            <li>• До <b>50 000</b> просмотров отзывов/день</li>
            <li>• Быстрые очереди анализа</li>
            <li>• Приоритетная поддержка</li>
          </ul>

          <div className="mt-6 flex items-center gap-2">
            <Link href="#" className="btn h-11 px-6">Купить подписку</Link>
            <span className="text-sm text-muted-foreground">от $5–10 / мес</span>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-foreground underline-offset-4 hover:underline">
          ← На главную
        </Link>
      </div>
    </section>
  )
}
