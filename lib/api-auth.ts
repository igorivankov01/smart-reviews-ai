// lib/api-auth.ts
import type { NextApiRequest } from 'next'
import { supabasePublic } from './supabasePublic'

export type ApiUser = { userId: string | null; accessToken: string | null }

/**
 * Извлекает Bearer токен из заголовка Authorization и валидирует его через Supabase.
 * Работает с anon-ключом — сервисный ключ не нужен.
 */
export async function getUserFromRequest(req: NextApiRequest): Promise<ApiUser> {
  const auth = req.headers.authorization
  if (!auth || typeof auth !== 'string') return { userId: null, accessToken: null }

  const m = auth.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1]?.trim()
  if (!token) return { userId: null, accessToken: null }

  try {
    const { data, error } = await supabasePublic.auth.getUser(token)
    if (error) return { userId: null, accessToken: null }
    const uid = data?.user?.id ?? null
    return { userId: uid, accessToken: token }
  } catch {
    return { userId: null, accessToken: null }
  }
}
