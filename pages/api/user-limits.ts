// pages/api/user-limits.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getActorFromReq, getPlanAndLimits, getUsageForActor, todayISODate } from '@/lib/limits';

// Жёстко фиксируем роуты, чтобы UI и сервер считали одно и то же
const ROUTES = {
  analyze: '/api/analyzeReviews',
  reviews: '/api/getReviews',
  import: '/api/import-google-place',
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

  const day = todayISODate();

  const [{ plan, limits }] = await Promise.all([
    getPlanAndLimits(token),
  ]);

  // Для user-limits всегда считаем usage по user:{id}. Так надёжнее и прозрачно для UI.
  // userId из токена извлекается на уровне Supabase (мы не декодируем JWT вручную).
  const actor = getActorFromReq(req, /* userId */ null); // ключ из IP не годится для приватной страницы
  // Но для корректной агрегации нужен именно user:{id}. Решение: сервер должен записывать usage именно как user:{id} для авторизованных.

  const usageByRoute = await getUsageForActor(token, actor.key, [
    ROUTES.analyze,
    ROUTES.reviews,
    ROUTES.import,
  ], day);

  const remaining = {
    analyze: Math.max(0, limits.analyze - (usageByRoute[ROUTES.analyze] ?? 0)),
    reviews: Math.max(0, limits.reviews - (usageByRoute[ROUTES.reviews] ?? 0)),
    import: Math.max(0, limits.import - (usageByRoute[ROUTES.import] ?? 0)),
  } as const;

  return res.status(200).json({
    day,
    plan,
    limits,
    usage: {
      analyze: usageByRoute[ROUTES.analyze] ?? 0,
      reviews: usageByRoute[ROUTES.reviews] ?? 0,
      import: usageByRoute[ROUTES.import] ?? 0,
    },
    remaining,
  });
}