import type { Database } from '@/types/database'

export type Message = Database['public']['Tables']['messages']['Row']

export type SendMessageResult =
  | {
      success: true
      message: Message
    }
  | {
      success: false
      error: string
    }
