import Link from 'next/link'
import { MessageCircle, ArrowLeft } from 'lucide-react'
import { CreateRoomForm } from '@/features/rooms/components/create-room-form'

export const metadata = {
  title: 'Create a Room — ChatboxAI',
}

export default function CreateRoomPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b px-6 py-4 flex items-center max-w-6xl mx-auto">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <span className="font-bold">ChatboxAI</span>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Create a room</h1>
          <p className="text-muted-foreground text-sm">
            Set up your chat room and share the link with anyone
          </p>
        </div>
        <div className="bg-card border rounded-2xl p-6">
          <CreateRoomForm />
        </div>
      </div>
    </main>
  )
}
