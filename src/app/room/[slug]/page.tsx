import { notFound } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getRoomBySlug } from '@/features/rooms/lib/room-queries'
import { getMessagesByRoom } from '@/features/chat/lib/message-queries'
import { ChatRoom } from '@/features/chat/components/chat-room'

interface RoomPageProps {
  params: Promise<{ slug: string }>
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { slug } = await params
  const supabase = await getSupabaseServerClient()

  const room = await getRoomBySlug(slug, supabase)
  if (!room) notFound()

  const messages = await getMessagesByRoom(room.id, supabase)

  return (
    <main className="flex flex-col h-screen bg-background">
      <ChatRoom room={room} initialMessages={messages} />
    </main>
  )
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { slug } = await params
  const supabase = await getSupabaseServerClient()
  const room = await getRoomBySlug(slug, supabase)
  return {
    title: room ? `${room.name} — ChatboxAI` : 'Room not found — ChatboxAI',
  }
}
