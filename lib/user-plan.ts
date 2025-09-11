// lib/user-plan.ts
import { supabasePublic } from './supabasePublic'

export type PlanName = 'free' | 'pro'

export type PlanLimits = {
  plan: PlanName
  analyze: number
  reviews: number
  importPlace: number
}

type ProfileRow = {
  user_id: string
  plan: PlanName
  daily_analyze_limit: number
  daily_reviews_limit: number
  daily_import_limit: number
}

const DEFAULTS: PlanLimits = {
  plan: 'free',
  analyze: Number(process.env.FREE_ANALYZE_LIMIT ?? 3),
  reviews: Number(process.env.FREE_REVIEWS_LIMIT ?? 500),
  importPlace: Number(process.env.FREE_IMPORT_LIMIT ?? 10),
}

export async function getUserPlanLimits(userId: string | null): Promise<PlanLimits> {
  if (!userId) return DEFAULTS
  const { data, error } = await supabasePublic
    .from('profiles')
    .select('plan,daily_analyze_limit,daily_reviews_limit,daily_import_limit')
    .eq('user_id', userId)
    .maybeSingle<ProfileRow>()
  if (error || !data) return DEFAULTS
  return {
    plan: data.plan,
    analyze: data.daily_analyze_limit,
    reviews: data.daily_reviews_limit,
    importPlace: data.daily_import_limit,
  }
}
