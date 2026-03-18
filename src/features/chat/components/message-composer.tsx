'use client'

import { useRef, useTransition } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendMessage } from '../actions/send-message'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  roomId: string
  guestId: string
  senderName: string
  onOptimisticSend?: (body: string) => void
}

export function MessageComposer({
  roomId,
  guestId,
  senderName,
  onOptimisticSend,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    const body = textareaRef.current?.value.trim()
    if (!body) return

    // Optimistic update
    onOptimisticSend?.(body)

    // Clear input immediately
    if (textareaRef.current) textareaRef.current.value = ''

    startTransition(async () => {
      const result = await sendMessage({
        room_id: roomId,
        sender_guest_id: guestId,
        sender_name: senderName,
        body,
      })
      if (!result.success) {
        toast.error(result.error)
        // Restore message on failure
        if (textareaRef.current) textareaRef.current.value = body
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t bg-white dark:bg-gray-950 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          className={cn(
            'flex-1 resize-none overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700',
            'px-3 py-2 text-sm bg-transparent',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'min-h-[40px] max-h-[160px]',
            'placeholder:text-muted-foreground'
          )}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={isPending}
        />
        <button
          onClick={handleSend}
          disabled={isPending}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}
