import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <MessageCircle className="w-6 h-6 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Room not found</h1>
      <p className="text-muted-foreground text-sm mb-6">
        This room doesn&apos;t exist or is no longer active.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Back to home
      </Link>
    </main>
  )
}
