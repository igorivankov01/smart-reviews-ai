// components/profile/limits-card.tsx
import { useEffect, useState } from 'react';

type Limits = { analyze: number; reviews: number; import: number };

type Payload = {
  day: string;
  plan: 'free' | 'pro';
  limits: Limits;
  usage: Limits;
  remaining: Limits;
};

export default function LimitsCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/user-limits', {
          headers: {
            // Важно: клиент Supabase обычно добавляет Bearer автоматически при SSR/Edge
            // Если у вас не так — прокиньте токен вручную.
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Payload;
        setData(json);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    void run();
  }, []);

  if (error) return <div className="rounded-2xl p-4 bg-[color:var(--card)] text-[color:var(--foreground)]">Ошибка: {error}</div>;
  if (!data) return <div className="rounded-2xl p-4 bg-[color:var(--card)] text-[color:var(--foreground)]">Загружаем лимиты…</div>;

  const Row = ({ label, used, total }: { label: string; used: number; total: number }) => {
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span>{label}</span><span>{used}/{total}</span></div>
        <div className="h-2 w-full rounded-full bg-[color:var(--muted,#eee)]">
          <div
            className="h-2 rounded-full bg-[color:var(--foreground)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl p-6 bg-[color:var(--card)] text-[color:var(--foreground)] shadow">
      <div className="mb-4">
        <div className="text-xs opacity-70">День лимитов: {data.day}</div>
        <div className="text-xl font-semibold">План: {data.plan === 'pro' ? 'Pro' : 'Free'}</div>
      </div>
      <div className="space-y-4">
        <Row label="Анализы (сводки)" used={data.usage.analyze} total={data.limits.analyze} />
        <Row label="Отзывы (единицы)" used={data.usage.reviews} total={data.limits.reviews} />
        <Row label="Импорт Google" used={data.usage.import} total={data.limits.import} />
      </div>
    </div>
  );
}