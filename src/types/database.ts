export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string
          slug: string
          name: string
          room_type: 'open' | 'secured'
          secret_code_hash: string | null
          created_at: string
          updated_at: string
          created_by_guest_id: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          room_type: 'open' | 'secured'
          secret_code_hash?: string | null
          created_at?: string
          updated_at?: string
          created_by_guest_id?: string | null
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
      }
      messages: {
        Row: {
          id: string
          room_id: string
          sender_guest_id: string
          sender_name: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          sender_guest_id: string
          sender_name: string
          body: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      participants: {
        Row: {
          id: string
          room_id: string
          guest_id: string
          display_name: string
          joined_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          room_id: string
          guest_id: string
          display_name: string
          joined_at?: string
          last_seen_at?: string
        }
        Update: Partial<Database['public']['Tables']['participants']['Insert']>
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          window_start: string
          count: number
        }
        Insert: {
          id?: string
          key: string
          window_start: string
          count?: number
        }
        Update: Partial<Database['public']['Tables']['rate_limits']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
