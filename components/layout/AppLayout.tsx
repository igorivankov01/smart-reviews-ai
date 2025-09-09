import Head from 'next/head'
import Link from 'next/link'
import { PropsWithChildren } from 'react'


export default function AppLayout({ children }: PropsWithChildren) {
return (
<>
<Head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI‑Отзывы об отелях</title>
</Head>


<header className="sticky top-0 z-30 border-b bg-background/75 backdrop-blur">
<div className="container flex h-14 items-center justify-between">
<Link href="/" className="font-semibold tracking-tight">Hotel‑AI</Link>
<nav className="flex items-center gap-2">
<Link href="/" className="btn btn-outline h-9">Главная</Link>
<a href="https://vercel.com" target="_blank" className="btn btn-secondary h-9">Deploy</a>
</nav>
</div>
</header>


<main className="min-h-[calc(100dvh-56px-56px)]">
{children}
</main>


<footer className="border-t">
<div className="container py-6 text-sm text-muted-foreground flex items-center justify-between">
<span>© {new Date().getFullYear()} Hotel‑AI</span>
<span>Built with Next.js · Tailwind · Supabase · OpenAI</span>
</div>
</footer>
</>
)
}