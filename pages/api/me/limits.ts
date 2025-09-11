// pages/api/me/limits.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getUserIdFromRequest } from '../../../lib/auth-server'
import { getUserPlanLimits } from '../../../lib/user-plan'
import { buildActorKey, getClientIp, getUsageToday } from '../../../lib/rate-limit'

type LimitsResponse = {
  plan: 'free' | 'pro'
  today: {
    analyze: { used: number; limit: number; remaining: number }
    reviews: { used: number; limit: number; remaining: number }
    importPlace: { used: number; limit: number; remaining: number }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<LimitsResponse | { error: string }>) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return res.status(401).json({ error: 'Sign-in required' })

  const limits = await getUserPlanLimits(userId)
  const actorKey = buildActorKey(userId, getClientIp(req))

  const routes = ['/api/analyzeReviews', '/api/getReviews', '/api/import-google-place']
  const usage = await getUsageToday(actorKey, routes)

  const usedAnalyze = usage['/api/analyzeReviews'] ?? 0
  const usedReviews = usage['/api/getReviews'] ?? 0
  const usedImport = usage['/api/import-google-place'] ?? 0

  return res.status(200).json({
    plan: limits.plan,
    today: {
      analyze: { used: usedAnalyze, limit: limits.analyze, remaining: Math.max(0, limits.analyze - usedAnalyze) },
      reviews: { used: usedReviews, limit: limits.reviews, remaining: Math.max(0, limits.reviews - usedReviews) },
      importPlace: { used: usedImport, limit: limits.importPlace, remaining: Math.max(0, limits.importPlace - usedImport) },
    },
  })
}
