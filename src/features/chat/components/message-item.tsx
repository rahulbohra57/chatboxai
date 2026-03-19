import { Sparkles } from 'lucide-react'
import { formatRelativeTime, formatFullTimestamp } from '@/lib/utils/dates'
import type { Message } from '../types/message.types'
import { cn } from '@/lib/utils'

const SYSTEM_GUEST_ID = '__system__'

interface MessageItemProps {
  message: Message
  isOwnMessage: boolean
  isAIMessage?: boolean
}

export function MessageItem({ message, isOwnMessage, isAIMessage }: MessageItemProps) {
  // System event messages (join/leave) render as a centered pill
  if (message.sender_guest_id === SYSTEM_GUEST_ID) {
    return (
      <div className="flex justify-center px-4 py-1.5">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.body}
        </span>
      </div>
    )
  }

  const initial = message.sender_name.charAt(0).toUpperCase()

  return (
    <div className={cn('flex gap-3 px-4 py-2 hover:bg-muted/30 transition-colors', isOwnMessage && 'flex-row-reverse')}>
      {/* Avatar */}
      {isAIMessage ? (
        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 ring-1 ring-violet-300 dark:ring-violet-700">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
          {initial}
        </div>
      )}

      {/* Content */}
      <div className={cn('flex flex-col gap-1 min-w-0 max-w-[75%]', isOwnMessage && 'items-end')}>
        <div className={cn('flex items-baseline gap-2', isOwnMessage && 'flex-row-reverse')}>
          <span className={cn('text-xs font-semibold', isAIMessage && 'text-violet-600 dark:text-violet-400')}>
            {message.sender_name}
          </span>
          <span
            className="text-xs text-muted-foreground cursor-default"
            title={formatFullTimestamp(message.created_at)}
          >
            {formatRelativeTime(message.created_at)}
          </span>
        </div>
        <div className={cn(
          'text-sm rounded-2xl px-3 py-2 break-words whitespace-pre-wrap',
          isOwnMessage
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : isAIMessage
              ? 'bg-violet-50 dark:bg-violet-900/20 text-foreground border border-violet-200 dark:border-violet-800 rounded-tl-sm'
              : 'bg-muted rounded-tl-sm'
        )}>
          {message.body}
        </div>
      </div>
    </div>
  )
}
