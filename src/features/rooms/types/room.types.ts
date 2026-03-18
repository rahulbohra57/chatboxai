import type { Database } from '@/types/database'

export type Room = Database['public']['Tables']['rooms']['Row']

// Room without sensitive hash field — safe to send to client
export type RoomPublic = Omit<Room, 'secret_code_hash'>

export type RoomType = 'open' | 'secured'

export type CreateRoomResult =
  | {
      success: true
      slug: string
    }
  | {
      success: false
      error: string
    }

export type JoinRoomResult =
  | {
      success: true
    }
  | {
      success: false
      error: string
    }
