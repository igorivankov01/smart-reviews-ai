// pages/profile.tsx
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

type Limits = {
  plan: 'free' | 'pro'
  today: {
    analyze: { used: number; limit: number; remaining: number }
    reviews: { used: number; limit: number; remaining: number }
    importPlace: { used: number; limit: number; remaining: number }
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const u = data.session?.user ?? null
      setUser(u)
      setLoading(false)
      if (u) {
        fetch('/api/me/limits', { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } })
          .then((r) => r.json())
          .then((j: Limits | { error: string }) => {
            if ('error' in j) throw new Error(j.error)
            setLimits(j)
          })
          .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load limits'))
      }
    })
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <section className="container py-12">
        <p className="text-muted-foreground">Loading profile...</p>
      </section>
    )
  }
  if (!user) {
    return (
      <section className="container py-12">
        <p className="text-muted-foreground">You are not signed in. Go to the Sign in page.</p>
      </section>
    )
  }

  return (
    <section className="container py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">Email</div>
          <div className="mt-1 font-semibold break-all">{user.email}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">User ID</div>
          <div className="mt-1 font-semibold break-all">{user.id}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">Plan</div>
          <div className="mt-1 font-semibold">{limits?.plan ?? '—'}</div>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Limits</h2>
      {error && <p className="mt-2 text-danger text-sm">{error}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">AI-analyses</div>
          <div className="mt-1 text-2xl font-semibold">
            {limits ? `${limits.today.analyze.remaining}/${limits.today.analyze.limit}` : '—'}
          </div>
          <div className="text-sm text-muted-foreground">used: {limits?.today.analyze.used ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">Review fetches</div>
          <div className="mt-1 text-2xl font-semibold">
            {limits ? `${limits.today.reviews.remaining}/${limits.today.reviews.limit}` : '—'}
          </div>
          <div className="text-sm text-muted-foreground">used: {limits?.today.reviews.used ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-muted-foreground">Google Place imports</div>
          <div className="mt-1 text-2xl font-semibold">
            {limits ? `${limits.today.importPlace.remaining}/${limits.today.importPlace.limit}` : '—'}
          </div>
          <div className="text-sm text-muted-foreground">used: {limits?.today.importPlace.used ?? 0}</div>
        </div>
      </div>
    </section>
  )
}
