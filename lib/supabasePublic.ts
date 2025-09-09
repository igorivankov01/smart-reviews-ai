// lib/supabasePublic.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Клиент для публичных запросов (и фронта, и API-роутов)
export const supabasePublic = createClient(url, anon, {
  auth: { persistSession: false }, // нам сессии тут не нужны
})
