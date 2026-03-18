import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Message } from '../types/message.types'

/**
 * Fetches the most recent messages for a room, ordered oldest first.
 */
export async function getMessagesByRoom(
  roomId: string,
  supabase: SupabaseClient<Database>,
  limit = 100
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, sender_guest_id, sender_name, body, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[message-queries] getMessagesByRoom error:', error)
    return []
  }
  return data ?? []
}
