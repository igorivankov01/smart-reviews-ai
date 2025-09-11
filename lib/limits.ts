// lib/limits.ts
import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

export type Plan = 'free' | 'pro';

export interface Limits {
  analyze: number;  // /api/analyzeReviews — штук в день
  reviews: number;  // /api/getReviews — «единиц» в день (ожидаем, что пишете в api_usage.count именно объём)
  import: number;   // /api/import-google-place — штук в день
}

export interface PlanAndLimits { plan: Plan; limits: Limits; }

const DEFAULTS: Limits = {
  analyze: parseInt(process.env.FREE_ANALYZE_LIMIT ?? '3', 10),
  reviews: parseInt(process.env.FREE_REVIEWS_LIMIT ?? '500', 10),
  import: parseInt(process.env.FREE_IMPORT_LIMIT ?? '10', 10),
};

function getSupabaseForUser(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function getActorFromReq(req: NextApiRequest, userId?: string | null): { key: string } {
  if (userId) return { key: `user:${userId}` };
  const xf = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const ip = xf || (req.socket.remoteAddress ?? '0.0.0.0');
  return { key: `ip:${ip}` };
}

export async function getPlanAndLimits(accessToken: string): Promise<PlanAndLimits> {
  const supabase = getSupabaseForUser(accessToken);
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, analyze_limit, reviews_limit, import_limit')
    .single();

  if (error || !data) return { plan: 'free', limits: DEFAULTS };

  const plan = (data.plan as Plan) ?? 'free';
  return {
    plan,
    limits: {
      analyze: Number(data.analyze_limit ?? DEFAULTS.analyze),
      reviews: Number(data.reviews_limit ?? DEFAULTS.reviews),
      import: Number(data.import_limit ?? DEFAULTS.import),
    },
  };
}

export function todayISODate(): string {
  // День лимитов считаем в UTC-днях. При желании можно сдвинуть на ваш TZ.
  return new Date().toISOString().slice(0, 10);
}

export type UsageByRoute = Record<string, number>;

export async function getUsageForActor(
  accessToken: string,
  actorKey: string,
  routes: string[],
  dayISO: string
): Promise<UsageByRoute> {
  const supabase = getSupabaseForUser(accessToken);
  const usage: UsageByRoute = {};

  for (const route of routes) {
    const { data, error } = await supabase
      .from('api_usage')
      .select('count')
      .eq('ip', actorKey)   // ip коллонка хранит actorKey (user:... или ip:...)
      .eq('route', route)
      .eq('day', dayISO);

    if (error || !data) {
      usage[route] = 0;
    } else {
      usage[route] = data.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
    }
  }
  return usage;
} 