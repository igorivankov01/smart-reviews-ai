// pages/sign-in.tsx
import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '../lib/supabase-browser'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : undefined

  async function onEmailSignIn() {
    const e = email.trim()
    if (!e) return
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabaseBrowser.auth.signInWithOtp({
        email: e,
        options: { emailRedirectTo: redirectTo },
      })
      if (err) throw err
      setSent(true)
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Email delivery error')
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (err) throw err
      // дальше произойдёт редирект на /auth/callback, router не нужен
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'OAuth error')
      setLoading(false)
    }
  }

  return (
    <section className="container py-12">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
        <p className="mt-2 text-muted-foreground">
          Use a magic link or continue with Google.
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-2xl border bg-card px-4 outline-none focus:ring-4 focus:ring-primary/20"
            aria-label="Email"
          />
          <button
            className="btn h-11 w-full"
            onClick={onEmailSignIn}
            disabled={loading || !email.trim()}
          >
            {loading ? 'Sending...' : 'Sign in via email'}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <button className="btn btn-outline h-11 w-full" onClick={onGoogle} disabled={loading}>
            Continue with Google
          </button>

          {sent && (
            <p className="text-sm text-muted-foreground">
              Email sent. Check your inbox and follow the link.
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="mt-4 text-center text-sm">
            <Link href="/" className="text-foreground underline-offset-4 hover:underline">
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
