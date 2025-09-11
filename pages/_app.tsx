// pages/_app.tsx
import type { AppProps } from 'next/app'
import '../styles/globals.css' // оставь как у тебя названы глобальные стили
import Header from '../components/layout/header'

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Component {...pageProps} />
      </main>
    </div>
  )
}
