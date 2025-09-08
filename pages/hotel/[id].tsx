// pages/hotel/[id].tsx
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Review = {
  id: string;
  text: string;
  rating: number | null;
  created_at: string;
};

type SummaryStats = {
  reviews_count: number;
  generated_at: string; // ISO
};

type SummaryPayload = {
  model: string;
  content: string;
  stats: SummaryStats;
};

type AnalyzeResponse =
  | { cached: boolean; summary: SummaryPayload }
  | { error: string };

type Hotel = {
  id: string;
  name: string;
  location?: string | null;
  image_url?: string | null;
};

function timeAgo(iso?: string) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

export default function HotelPage() {
  const router = useRouter();
  const hotel_id = (router.query.id as string) ?? '123';

  // Карточка отеля
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [hotelLoading, setHotelLoading] = useState(false);

  // Отзывы
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);

  // Выжимка
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка карточки отеля
  useEffect(() => {
    if (!hotel_id) return;
    setHotelLoading(true);
    fetch(`/api/getHotel?id=${encodeURIComponent(hotel_id)}`)
      .then((r) => r.json())
      .then((d) => setHotel(d.data ?? null))
      .catch(() => setHotel(null))
      .finally(() => setHotelLoading(false));
  }, [hotel_id]);

  // Загрузка отзывов (3 или пагинация по 20)
  const loadReviews = useCallback(
    async (takeAll: boolean, pageArg?: number) => {
      setReviewsLoading(true);
      try {
        const useLimit = takeAll ? String(pageSize) : '3';
        const usePage = takeAll ? (pageArg ?? page) : 1;
        const offsetNum = (usePage - 1) * (takeAll ? pageSize : 3);

        const params = new URLSearchParams({
          hotel_id,
          limit: useLimit,
          offset: String(offsetNum),
        });

        const r = await fetch(`/api/getReviews?` + params.toString());
        const d = await r.json();
        setReviews(d.data ?? []);
        if (typeof d.total === 'number') setTotal(d.total);
      } catch {
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    },
    [hotel_id, page, pageSize]
  );

  useEffect(() => {
    if (!hotel_id) return;
    setShowAll(false);
    setPage(1);
    void loadReviews(false); // первые 3 отзыва
  }, [hotel_id, loadReviews]);

  // Анализ / кэш / форс-обновление
  const runAnalyze = async (opts?: { force?: boolean }) => {
    setError(null);
    if (opts?.force) {
      setLoadingRefresh(true);
    } else {
      setLoading(true);
    }
    try {
      const url = `/api/analyzeReviews?hotel_id=${encodeURIComponent(hotel_id)}${
        opts?.force ? '&force=true' : ''
      }`;
      const resp = await fetch(url);
      const data: AnalyzeResponse = await resp.json();

      if ('error' in data) {
        setError(data.error);
        setSummary(null);
        setCached(null);
      } else {
        setSummary(data.summary);
        setCached(data.cached);
      }
    } catch {
      setError('Не удалось получить выжимку. Проверьте подключение.');
    } finally {
      if (opts?.force) {
        setLoadingRefresh(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Метки времени
  const freshness = useMemo(() => {
    if (!summary?.stats?.generated_at) return '';
    return timeAgo(summary.stats.generated_at);
  }, [summary?.stats?.generated_at]);

  const generatedAtLocal = useMemo(() => {
    if (!summary?.stats?.generated_at) return '';
    try {
      return new Date(summary.stats.generated_at).toLocaleString('ru-RU');
    } catch {
      return new Date(summary.stats.generated_at).toLocaleString();
    }
  }, [summary?.stats?.generated_at]);

  // Пагинация: вычислим пределы
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Навигация назад */}
      <div className="flex items-start gap-4">
        <button
          className="text-sm underline underline-offset-4"
          onClick={() => router.push('/')}
        >
          ← Назад к поиску
        </button>
      </div>

      {/* Карточка отеля */}
      <div className="rounded-xl border overflow-hidden">
        {hotelLoading ? (
          // Скелетон карточки
          <div className="p-4 animate-pulse">
            <div className="h-40 w-full bg-neutral-200 rounded-xl mb-3" />
            <div className="h-5 w-1/3 bg-neutral-200 rounded mb-2" />
            <div className="h-4 w-1/4 bg-neutral-200 rounded" />
          </div>
        ) : hotel ? (
          <div className="md:flex">
            {hotel.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hotel.image_url}
                alt={hotel.name}
                className="w-full md:w-64 h-40 object-cover"
              />
            ) : null}
            <div className="p-4 flex-1">
              <div className="text-xl font-semibold">{hotel.name}</div>
              <div className="text-sm opacity-70">
                {hotel.location || 'Локация не указана'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm opacity-70">Отель не найден</div>
        )}
      </div>

      {/* Кнопки анализа */}
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Анализ отзывов</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={loading || loadingRefresh}
            onClick={() => runAnalyze()}
            title="Запросит выжимку (использует кэш, если свежий)"
          >
            {loading ? 'Анализирую…' : 'Сделать выжимку AI'}
          </button>
          <button
            className="px-4 py-2 rounded-xl border disabled:opacity-50"
            disabled={loading || loadingRefresh}
            onClick={() => runAnalyze({ force: true })}
            title="Принудительно пересчитать (игнорировать кэш)"
          >
            {loadingRefresh ? 'Обновляю…' : 'Обновить выжимку'}
          </button>
        </div>
      </header>

      {/* Бейдж свежести */}
      {(cached !== null || summary) ? (
        <div className="flex items-center gap-3">
          {cached ? (
            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-neutral-100">
              кэшировано {freshness || 'ранее'} • {generatedAtLocal}
            </span>
          ) : summary ? (
            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-emerald-100">
              свежее ({freshness || 'только что'}) • {generatedAtLocal}
            </span>
          ) : null}

          {summary?.stats?.reviews_count !== undefined ? (
            <span className="text-xs opacity-70">
              основано на {summary.stats.reviews_count} отзывах
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Ошибки */}
      {error ? (
        <div className="p-3 rounded-xl border border-red-300 text-red-700">
          {error}
        </div>
      ) : null}

      {/* Контент выжимки */}
      {summary?.content ? (
        <div className="p-4 rounded-xl border whitespace-pre-wrap">
          {summary.content}
        </div>
      ) : (
        <div className="text-sm opacity-70">
          Нажмите «Сделать выжимку AI», чтобы получить краткое резюме по отзывам.
        </div>
      )}

      {/* Список отзывов */}
      <section className="space-y-3">
        <h3 className="text-lg font-medium">Отзывы</h3>

        {reviewsLoading ? (
          // Скелетон отзывов (3 блока)
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 border rounded-xl animate-pulse">
                <div className="h-3 w-32 bg-neutral-200 rounded mb-2" />
                <div className="h-4 w-10 bg-neutral-200 rounded mb-2" />
                <div className="h-4 w-full bg-neutral-200 rounded mb-1" />
                <div className="h-4 w-5/6 bg-neutral-200 rounded" />
              </div>
            ))}
          </div>
        ) : null}

        {reviews.map((r) => (
          <article key={r.id} className="p-3 border rounded-xl">
            <div className="text-xs opacity-70">
              {new Date(r.created_at).toLocaleString('ru-RU')}
            </div>
            <div className="font-medium">{r.rating ?? '—'}/5</div>
            <p>{r.text}</p>
          </article>
        ))}

        {reviews.length === 0 && !reviewsLoading ? (
          <div className="text-sm opacity-70">Отзывов пока нет.</div>
        ) : null}

        {/* Кнопка переключения на все отзывы */}
        {!showAll && reviews.length >= 3 ? (
          <div>
            <button
              className="mt-2 px-4 py-2 rounded-xl border disabled:opacity-50"
              disabled={reviewsLoading}
              onClick={async () => {
                setShowAll(true);
                setPage(1);
                await loadReviews(true, 1);
              }}
            >
              {reviewsLoading ? 'Загружаю…' : 'Посмотреть все отзывы'}
            </button>
          </div>
        ) : null}

        {/* Пагинация (только в режиме всех отзывов) */}
        {showAll ? (
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs opacity-70">
              Стр. {page} из {totalPages} • всего {total}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-xl border disabled:opacity-50"
                disabled={page <= 1 || reviewsLoading}
                onClick={async () => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  await loadReviews(true, next);
                }}
              >
                ← Назад
              </button>
              <button
                className="px-3 py-2 rounded-xl border disabled:opacity-50"
                disabled={page >= totalPages || reviewsLoading}
                onClick={async () => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  await loadReviews(true, next);
                }}
              >
                Вперёд →
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
