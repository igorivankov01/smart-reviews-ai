// pages/hotel/[id].tsx
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useCallback } from 'react';

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

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [hotelLoading, setHotelLoading] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  // Загрузка отзывов (3 или все)
  const loadReviews = useCallback(async (takeAll: boolean) => {
  setReviewsLoading(true);
  try {
    const params = new URLSearchParams({
      hotel_id,
      limit: takeAll ? '200' : '3',
      offset: '0',
    });
    const r = await fetch(`/api/getReviews?` + params.toString());
    const d = await r.json();
    setReviews(d.data ?? []);
  } catch {
    setReviews([]);
  } finally {
    setReviewsLoading(false);
  }
}, [hotel_id]);

useEffect(() => {
  if (!hotel_id) return;
  setShowAll(false);
  void loadReviews(false); // первые 3
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

  const freshness = useMemo(() => {
    if (!summary?.stats?.generated_at) return '';
    return timeAgo(summary.stats.generated_at);
  }, [summary?.stats?.generated_at]);

  const generatedAtLocal = useMemo(() => {
    if (!summary?.stats?.generated_at) return '';
    // Локализованный человекочитаемый штамп
    try {
      return new Date(summary.stats.generated_at).toLocaleString('ru-RU');
    } catch {
      return new Date(summary.stats.generated_at).toLocaleString();
    }
  }, [summary?.stats?.generated_at]);

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
          <div className="p-4 text-sm opacity-70">Загружаю карточку…</div>
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
          <div className="text-sm opacity-70">Загружаю отзывы…</div>
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

        {!showAll && reviews.length >= 3 ? (
          <div>
            <button
              className="mt-2 px-4 py-2 rounded-xl border disabled:opacity-50"
              disabled={reviewsLoading}
              onClick={async () => {
                setShowAll(true);
                await loadReviews(true);
              }}
            >
              {reviewsLoading ? 'Загружаю…' : 'Посмотреть все отзывы'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
