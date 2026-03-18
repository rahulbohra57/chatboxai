'use client'

import { useEffect, useState } from 'react'
import { useRealtimeMessages } from '../hooks/use-realtime-messages'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { JoinRoomForm } from '@/features/rooms/components/join-room-form'
import { RoomHeader } from '@/features/rooms/components/room-header'
import { getOrCreateGuestId, getDisplayName } from '@/lib/auth/guest-session'
import type { Message } from '../types/message.types'
import type { RoomPublic } from '@/features/rooms/types/room.types'

interface ChatRoomProps {
  room: RoomPublic
  initialMessages: Message[]
}

export function ChatRoom({ room, initialMessages }: ChatRoomProps) {
  const [guestId, setGuestId] = useState<string>('')
  const [displayName, setDisplayNameState] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])

  const realtimeMessages = useRealtimeMessages(room.id, initialMessages)

  // Hydrate guest identity from localStorage (client-side only)
  useEffect(() => {
    setGuestId(getOrCreateGuestId())
    setDisplayNameState(getDisplayName())
  }, [])

  // Merge realtime + optimistic messages (dedup by id)
  const allMessages = [...realtimeMessages]
  for (const opt of optimisticMessages) {
    if (!allMessages.find((m) => m.id === opt.id)) {
      allMessages.push(opt)
    }
  }
  allMessages.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const handleJoined = (name: string) => {
    setDisplayNameState(name)
  }

  const handleOptimisticSend = (body: string) => {
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      room_id: room.id,
      sender_guest_id: guestId,
      sender_name: displayName ?? 'You',
      body,
      created_at: new Date().toISOString(),
    }
    setOptimisticMessages((prev) => [...prev, optimistic])
  }

  // Show join form if user hasn't set a display name yet
  if (!displayName) {
    return (
      <div className="flex flex-col h-full">
        <RoomHeader room={room} />
        <JoinRoomForm room={room} onJoined={handleJoined} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <RoomHeader room={room} />
      <MessageList messages={allMessages} currentGuestId={guestId} />
      <MessageComposer
        roomId={room.id}
        guestId={guestId}
        senderName={displayName}
        onOptimisticSend={handleOptimisticSend}
      />
    </div>
  )
}
