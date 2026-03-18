'use client'

import Link from 'next/link'
import { MessageCircle, AlertCircle } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">
        We couldn&apos;t load this room. It may have been removed or there was a temporary error.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Go home
        </Link>
      </div>
    </main>
  )
}
