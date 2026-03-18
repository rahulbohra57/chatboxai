import { MessageCircle } from 'lucide-react'

export function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <MessageCircle className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
      <p className="text-xs text-muted-foreground mt-1">Be the first to say hi!</p>
    </div>
  )
}
