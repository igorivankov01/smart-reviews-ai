// lib/auth-server.ts
import type { NextApiRequest } from 'next'
import { supabasePublic } from './supabasePublic'

export async function getUserIdFromRequest(req: NextApiRequest): Promise<string | null> {
  const auth = req.headers.authorization
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  if (!token) return null

  const { data, error } = await supabasePublic.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}
