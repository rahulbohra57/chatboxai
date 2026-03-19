'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Zap, Lock, MessageCircle } from 'lucide-react'
import { JoinRoomInput } from '@/features/rooms/components/join-room-input'
import { YourRoomsList } from '@/features/rooms/components/your-rooms-list'
import { ClosedRoomToast } from '@/features/rooms/components/closed-room-toast'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <ClosedRoomToast />
      </Suspense>

      {/* Navigation */}
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">ChatboxAI</span>
        </div>
        <Link
          href="/create"
          className="text-sm font-medium px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Create room
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="w-3 h-3" />
          Real-time chat, zero friction
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Create a room.<br />
          Share a link.<br />
          <span className="text-primary">Chat instantly.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
          No signup needed. Create a chat room in seconds, share the link with anyone,
          and start chatting in real time from any device.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Create a room
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm text-muted-foreground">or join an existing room</p>
            <JoinRoomInput />
          </div>
        </div>
      </section>

      {/* Your Rooms */}
      <YourRoomsList />

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: 'Instant rooms',
              description: 'Create a room in under a minute. Share the link and your guests are in.',
            },
            {
              icon: MessageCircle,
              title: 'Real-time chat',
              description: 'Messages appear instantly for everyone in the room. No refresh needed.',
            },
            {
              icon: Lock,
              title: 'Secured rooms',
              description: 'Protect your room with a secret code. Only invited guests can join.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="p-6 rounded-xl border bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>ChatboxAI — Chat without barriers</p>
      </footer>
    </main>
  )
}
