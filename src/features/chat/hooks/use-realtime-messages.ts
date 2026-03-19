'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import type { Message } from '../types/message.types'
import type { RoomPublic } from '@/features/rooms/types/room.types'

export function useRealtimeMessages(
  roomId: string,
  initialMessages: Message[],
  isClosingRef: React.MutableRefObject<boolean>
): {
  messages: Message[]
  addMessage: (msg: Message) => void
  addOptimistic: (tempId: string, msg: Message) => void
  confirmOptimistic: (tempId: string, realMessage: Message) => void
  broadcastRoomClosed: (closedBy: string) => Promise<void>
} {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const seenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)))
  const lastSeenAt = useRef<string>(
    initialMessages.at(-1)?.created_at ?? new Date(0).toISOString()
  )
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  // Add a message that already has a real ID (e.g. AI response)
  const addMessage = useCallback((msg: Message) => {
    if (!seenIds.current.has(msg.id)) {
      seenIds.current.add(msg.id)
      if (msg.created_at > lastSeenAt.current) {
        lastSeenAt.current = msg.created_at
      }
      setMessages((prev) => [...prev, msg])
    }
  }, [])

  // Add an optimistic placeholder (temp ID, shown immediately)
  const addOptimistic = useCallback((tempId: string, msg: Message) => {
    if (!seenIds.current.has(tempId)) {
      seenIds.current.add(tempId)
      setMessages((prev) => [...prev, msg])
    }
  }, [])

  // Atomically swap the optimistic placeholder for the confirmed real message.
  // Pre-registers the real ID in seenIds so the realtime subscription
  // cannot race-add a duplicate.
  // If polling already added the real message (race), just remove the placeholder.
  const confirmOptimistic = useCallback((tempId: string, realMessage: Message) => {
    seenIds.current.add(realMessage.id)
    if (realMessage.created_at > lastSeenAt.current) {
      lastSeenAt.current = realMessage.created_at
    }
    setMessages((prev) => {
      const alreadyPresent = prev.some((m) => m.id === realMessage.id)
      if (alreadyPresent) {
        // Polling beat us to it — drop the optimistic placeholder
        return prev.filter((m) => m.id !== tempId)
      }
      return prev.map((m) => (m.id === tempId ? realMessage : m))
    })
    seenIds.current.delete(tempId)
  }, [])

  // Sends a broadcast on the existing channel so all members get redirected.
  // Called by chat-room.tsx after close-room action succeeds.
  const broadcastRoomClosed = useCallback(async (closedBy: string) => {
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'room-closed',
      payload: { closedBy },
    })
  }, [])

  // Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'broadcast',
        { event: 'room-closed' },
        (payload) => {
          if (!isClosingRef.current) {
            const name = (payload.payload as { closedBy?: string })?.closedBy ?? 'someone'
            toast.error(`This room was closed by ${name}`, { duration: 4000 })
            setTimeout(() => router.push('/'), 2000)
          }
        }
      )
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
            if (newMessage.created_at > lastSeenAt.current) {
              lastSeenAt.current = newMessage.created_at
            }
            setMessages((prev) => [...prev, newMessage])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as Pick<RoomPublic, 'is_active' | 'closed_by_name'>
          if (updated.is_active === false && !isClosingRef.current) {
            toast.error(
              `This room was closed by ${updated.closed_by_name ?? 'someone'}`,
              { duration: 4000 }
            )
            setTimeout(() => router.push('/'), 2000)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [roomId, isClosingRef, router])

  // Polling fallback: fetch new messages every 2 seconds
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const poll = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, room_id, sender_guest_id, sender_name, body, created_at')
        .eq('room_id', roomId)
        .gt('created_at', lastSeenAt.current)
        .order('created_at', { ascending: true })

      if (data?.length) {
        lastSeenAt.current = data.at(-1)!.created_at
        setMessages((prev) => {
          const next = [...prev]
          for (const msg of data) {
            if (!seenIds.current.has(msg.id)) {
              seenIds.current.add(msg.id)
              next.push(msg as Message)
            }
          }
          return next
        })
      }
    }

    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [roomId])

  return { messages, addMessage, addOptimistic, confirmOptimistic, broadcastRoomClosed }
}
