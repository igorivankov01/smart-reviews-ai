// components/layout/header.tsx
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../../lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function onSignOut() {
    await supabaseBrowser.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="container h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          smart-reviews.ai
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Тарифы
          </Link>

          {loading ? null : user ? (
            <>
              <Link href="/profile" className="btn h-9 px-4" aria-label="Открыть профиль">
                Профиль
              </Link>
              <button onClick={onSignOut} className="btn btn-outline h-9 px-4" aria-label="Выйти из аккаунта">
                Выйти
              </button>
            </>
          ) : (
            <Link href="/sign-in" className="btn h-9 px-4" aria-label="Войти">
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
