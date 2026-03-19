'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtimeMessages } from '../hooks/use-realtime-messages'
import { MessageList } from './message-list'
import { MessageComposer } from './message-composer'
import { JoinRoomForm } from '@/features/rooms/components/join-room-form'
import { RoomHeader } from '@/features/rooms/components/room-header'
import { getOrCreateGuestId, getDisplayName, hasJoinedRoom, addJoinedRoom, ensureJoinedRoom } from '@/lib/auth/guest-session'
import { closeRoom } from '@/features/rooms/actions/close-room'
import { getAIResponse } from '../actions/ai-response'
import { insertSystemMessage } from '../actions/system-message'
import type { Message } from '../types/message.types'
import type { RoomPublic } from '@/features/rooms/types/room.types'

const AI_GUEST_ID = 'ai-assistant-myai'

interface ChatRoomProps {
  room: RoomPublic
  initialMessages: Message[]
}

export function ChatRoom({ room, initialMessages }: ChatRoomProps) {
  const router = useRouter()
  const isClosingRef = useRef(false)
  const [guestId, setGuestId] = useState<string>('')
  const [displayName, setDisplayNameState] = useState<string | null>(null)
  const [hasJoinedThisRoom, setHasJoinedThisRoom] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const { messages, addMessage, addOptimistic, confirmOptimistic, broadcastRoomClosed } =
    useRealtimeMessages(room.id, initialMessages, isClosingRef)

  // Hydrate guest identity from localStorage (client-side only)
  useEffect(() => {
    const id = getOrCreateGuestId()
    const name = getDisplayName()
    setGuestId(id)
    setDisplayNameState(name)
    setHasJoinedThisRoom(hasJoinedRoom(room.slug))
    // Track this room for users who skip the join form (already have a display name)
    if (name) {
      ensureJoinedRoom({
        slug: room.slug,
        name: room.name,
        room_type: room.room_type as 'open' | 'secured',
        joinedAt: new Date().toISOString(),
      })
    }
  }, [room.slug, room.name, room.room_type])

  const handleJoined = (name: string) => {
    setDisplayNameState(name)
    addJoinedRoom({
      slug: room.slug,
      name: room.name,
      room_type: room.room_type,
      joinedAt: new Date().toISOString(),
    })
    setHasJoinedThisRoom(true)
    insertSystemMessage(room.id, `${name} joined the chat`)
  }

  const handleLeaveRoom = async () => {
    const name = displayName ?? 'Someone'
    await insertSystemMessage(room.id, `${name} left the chat`)
    router.push('/')
  }

  const handleCloseRoom = async () => {
    const name = displayName ?? 'Someone'
    isClosingRef.current = true
    setIsClosing(true)

    const result = await closeRoom(room.id, name)

    if (!result.success) {
      isClosingRef.current = false
      setIsClosing(false)
      toast.error(result.error ?? 'Failed to close room. Please try again.')
      return
    }

    // Broadcast to all room members before navigating
    await broadcastRoomClosed(name)
    router.push('/')
  }

  const handleOptimisticSend = (tempId: string, body: string) => {
    const optimistic: Message = {
      id: tempId,
      room_id: room.id,
      sender_guest_id: guestId,
      sender_name: displayName ?? 'You',
      body,
      created_at: new Date().toISOString(),
    }
    addOptimistic(tempId, optimistic)
  }

  const handleMessageConfirmed = (tempId: string, realMessage: Message) => {
    confirmOptimistic(tempId, realMessage)
    if (realMessage.body.toLowerCase().includes('@myai')) {
      getAIResponse(room.id, realMessage.body, messages).then((result) => {
        if (result.success && result.message) {
          addMessage(result.message)
        }
      })
    }
  }

  const needsJoin = !displayName || (room.room_type === 'secured' && !hasJoinedThisRoom)
  if (needsJoin) {
    return (
      <div className="flex flex-col h-full">
        <RoomHeader room={room} />
        <JoinRoomForm room={room} onJoined={handleJoined} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <RoomHeader
        room={room}
        onLeaveRoom={handleLeaveRoom}
        onCloseRoom={handleCloseRoom}
        isClosing={isClosing}
      />
      <MessageList messages={messages} currentGuestId={guestId} aiGuestId={AI_GUEST_ID} />
      <MessageComposer
        roomId={room.id}
        guestId={guestId}
        senderName={displayName}
        participants={[...new Set(messages.map((m) => m.sender_name).filter((n) => n !== displayName))]}
        onOptimisticSend={handleOptimisticSend}
        onMessageConfirmed={handleMessageConfirmed}
      />
    </div>
  )
}
