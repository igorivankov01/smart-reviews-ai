// lib/rate-limit.ts
import type { NextApiRequest } from 'next'
import { supabasePublic } from './supabasePublic'

export type RateLimitResult = {
  allowed: boolean
  count: number
  remaining: number
  limit: number
}

export function getClientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for']
  const first = Array.isArray(xff) ? xff[0] : xff
  if (first && typeof first === 'string') {
    const ip = first.split(',')[0]?.trim()
    if (ip) return ip
  }
  const ra = (req.socket && 'remoteAddress' in req.socket) ? req.socket.remoteAddress : null
  return typeof ra === 'string' && ra ? ra : 'unknown'
}

export function buildActorKey(userId: string | null, ip: string): string {
  return userId ? `user:${userId}` : `ip:${ip}`
}

/** Дневной лимит (как раньше) */
export async function rateLimit(route: string, actorKey: string, limit: number): Promise<RateLimitResult> {
  const day = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabasePublic
    .from('api_usage')
    .select('id,count')
    .eq('ip', actorKey)
    .eq('route', route)
    .eq('day', day)
    .maybeSingle<{ id: number; count: number }>()

  if (!existing) {
    await supabasePublic.from('api_usage').insert({ ip: actorKey, route, day, count: 1 })
    return { allowed: true, count: 1, remaining: Math.max(0, limit - 1), limit }
  }

  const next = existing.count + 1
  if (next > limit) return { allowed: false, count: existing.count, remaining: 0, limit }

  await supabasePublic
    .from('api_usage')
    .update({ count: next, last_at: new Date().toISOString() })
    .eq('id', existing.id)

  return { allowed: true, count: next, remaining: Math.max(0, limit - next), limit }
}

/**
 * Месячный лимит (для неавторизованных).
 * 1) Суммируем usage за текущий месяц по route+actorKey.
 * 2) Если ещё есть запас — инкрементируем сегодняшнюю запись (чтобы учитывалось и по дням).
 */
export async function rateLimitMonthly(route: string, actorKey: string, monthlyLimit: number): Promise<RateLimitResult> {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const monthNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)

  const { data: rows } = await supabasePublic
    .from('api_usage')
    .select('count,day')
    .eq('ip', actorKey)
    .eq('route', route)
    .gte('day', monthStart)
    .lt('day', monthNext)

  const used = (rows ?? []).reduce<number>((acc, r) => acc + (typeof r.count === 'number' ? r.count : 0), 0)
  if (used >= monthlyLimit) return { allowed: false, count: used, remaining: 0, limit: monthlyLimit }

  // Инкремент сегодня
  const day = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabasePublic
    .from('api_usage')
    .select('id,count')
    .eq('ip', actorKey)
    .eq('route', route)
    .eq('day', day)
    .maybeSingle<{ id: number; count: number }>()

  if (!existing) {
    await supabasePublic.from('api_usage').insert({ ip: actorKey, route, day, count: 1 })
  } else {
    await supabasePublic
      .from('api_usage')
      .update({ count: existing.count + 1, last_at: new Date().toISOString() })
      .eq('id', existing.id)
  }

  const newUsed = used + 1
  return { allowed: true, count: newUsed, remaining: Math.max(0, monthlyLimit - newUsed), limit: monthlyLimit }
}

/** Сводка сегодняшнего использования (для профиля) */
export async function getUsageToday(actorKey: string, routes: string[]) {
  const day = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabasePublic
    .from('api_usage')
    .select('route,count')
    .eq('ip', actorKey)
    .eq('day', day)

  if (error || !data) return Object.fromEntries(routes.map((r) => [r, 0]))
  const map = new Map<string, number>(data.map((r) => [r.route, r.count]))
  return Object.fromEntries(routes.map((r) => [r, map.get(r) ?? 0]))
}
