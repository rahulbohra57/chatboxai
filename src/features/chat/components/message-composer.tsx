'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { Send, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { sendMessage } from '../actions/send-message'
import { cn } from '@/lib/utils'
import type { Message } from '../types/message.types'

const AI_NAME = 'MyAI'

interface MentionOption {
  name: string
  isAI: boolean
}

interface MessageComposerProps {
  roomId: string
  guestId: string
  senderName: string
  participants: string[]
  onOptimisticSend?: (tempId: string, body: string) => void
  onMessageConfirmed?: (tempId: string, message: Message) => void
}

export function MessageComposer({
  roomId,
  guestId,
  senderName,
  participants,
  onOptimisticSend,
  onMessageConfirmed,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState('')
  const [mentionState, setMentionState] = useState<{ query: string; startPos: number } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Build the filtered mention options
  const mentionOptions: MentionOption[] = mentionState
    ? [
        { name: AI_NAME, isAI: true },
        ...participants
          .filter((p) => p !== AI_NAME && p !== senderName)
          .map((p) => ({ name: p, isAI: false })),
      ].filter((o) => o.name.toLowerCase().includes(mentionState.query.toLowerCase()))
    : []

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0)
  }, [mentionOptions.length])

  const insertMention = (name: string) => {
    const textarea = textareaRef.current
    if (!textarea || !mentionState) return

    const before = value.slice(0, mentionState.startPos)
    const after = value.slice(mentionState.startPos + 1 + mentionState.query.length)
    const newValue = `${before}@${name} ${after}`

    setValue(newValue)
    setMentionState(null)

    // Restore focus and set cursor after the mention
    textarea.focus()
    const newCursor = mentionState.startPos + name.length + 2
    setTimeout(() => {
      textarea.setSelectionRange(newCursor, newCursor)
      // Re-measure height
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }, 0)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`

    // Detect @mention at cursor
    const cursorPos = e.target.selectionStart ?? newValue.length
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      setMentionState({ query: atMatch[1], startPos: cursorPos - atMatch[0].length })
    } else {
      setMentionState(null)
    }
  }

  const handleSend = () => {
    const body = value.trim()
    if (!body) return

    const tempId = `optimistic-${crypto.randomUUID()}`
    onOptimisticSend?.(tempId, body)
    setValue('')
    setMentionState(null)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    startTransition(async () => {
      const result = await sendMessage({
        room_id: roomId,
        sender_guest_id: guestId,
        sender_name: senderName,
        body,
      })
      if (!result.success) {
        toast.error(result.error)
        setValue(body)
        return
      }
      if (result.message) {
        onMessageConfirmed?.(tempId, result.message)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, mentionOptions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionOptions[selectedIndex].name)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionState(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showPopup = mentionState !== null && mentionOptions.length > 0

  return (
    <div className="border-t bg-white dark:bg-gray-950 px-4 py-3">
      <div className="relative flex items-end gap-2">
        {/* Mention popup — positioned above the textarea */}
        {showPopup && (
          <div
            ref={popupRef}
            className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden"
          >
            {mentionOptions.map((option, i) => (
              <button
                key={option.name}
                type="button"
                onMouseDown={(e) => {
                  // Use onMouseDown to fire before textarea blur
                  e.preventDefault()
                  insertMention(option.name)
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                  i === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/60'
                )}
              >
                {option.isAI ? (
                  <Bot className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-medium">
                      {option.name[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-medium truncate">{option.name}</span>
                {option.isAI && (
                  <span className="ml-auto text-[10px] text-muted-foreground">AI</span>
                )}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Type a message… use @ to mention"
          className={cn(
            'flex-1 resize-none overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700',
            'px-3 py-2 text-sm bg-transparent',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'min-h-[40px] max-h-[160px]',
            'placeholder:text-muted-foreground'
          )}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
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
        Enter to send · Shift+Enter for new line · @ to mention
      </p>
    </div>
  )
}
