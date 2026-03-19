'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageItem } from './message-item'
import { EmptyChatState } from './empty-chat-state'
import type { Message } from '../types/message.types'

interface MessageListProps {
  messages: Message[]
  currentGuestId: string
  aiGuestId?: string
}

export function MessageList({ messages, currentGuestId, aiGuestId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)

  // Auto-scroll to bottom when new messages arrive (if user hasn't scrolled up)
  useEffect(() => {
    if (!userScrolled) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, userScrolled])

  // Detect when user manually scrolls up
  const handleScroll = () => {
    const container = containerRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    setUserScrolled(distanceFromBottom > 100)
  }

  if (messages.length === 0) {
    return <EmptyChatState />
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-2 scroll-smooth"
    >
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwnMessage={message.sender_guest_id === currentGuestId}
          isAIMessage={!!aiGuestId && message.sender_guest_id === aiGuestId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
