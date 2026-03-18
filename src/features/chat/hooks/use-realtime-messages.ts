'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { Message } from '../types/message.types'

/**
 * Manages real-time message subscriptions for a room.
 * - Starts with initialMessages
 * - Subscribes to new INSERT events for the room
 * - Deduplicates messages by ID
 * - Cleans up subscription on unmount
 */
export function useRealtimeMessages(
  roomId: string,
  initialMessages: Message[]
): Message[] {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)))

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message
          if (!seenIds.current.has(newMessage.id)) {
            seenIds.current.add(newMessage.id)
            setMessages((prev) => [...prev, newMessage])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return messages
}
