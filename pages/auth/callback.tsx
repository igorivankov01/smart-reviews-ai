// pages/auth/callback.tsx
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // supabaseBrowser.auth.detectSessionInUrl=true сам обработает токены из URL,
    // подождём чуть-чуть и утащим на профиль
    const t = setTimeout(() => {
      router.replace('/profile')
    }, 800)
    return () => clearTimeout(t)
  }, [router])

  return (
    <section className="container py-12 text-center">
      <h1 className="text-2xl font-semibold">Выполняем вход…</h1>
      <p className="mt-2 text-muted-foreground">Секунду…</p>
    </section>
  )
}
