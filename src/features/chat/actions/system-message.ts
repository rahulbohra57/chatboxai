'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const SYSTEM_GUEST_ID = '__system__'

export async function insertSystemMessage(
  roomId: string,
  body: string
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  await supabase.from('messages').insert({
    room_id: roomId,
    sender_guest_id: SYSTEM_GUEST_ID,
    sender_name: '',
    body,
  })
}
