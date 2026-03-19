'use server'

import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const closeRoomSchema = z.object({
  roomId: z.string().uuid(),
  displayName: z.string().min(1).max(50),
})

export type CloseRoomResult =
  | { success: true }
  | { success: false; error: string }

export async function closeRoom(
  roomId: string,
  displayName: string
): Promise<CloseRoomResult> {
  const parsed = closeRoomSchema.safeParse({ roomId, displayName })
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  const supabase = getSupabaseAdminClient()

  // Soft-close: triggers Supabase Realtime UPDATE event to all room subscribers.
  // Chain .select('id') so we can check if a row was actually updated
  // (Supabase JS v2 does not return a count from .update() without .select()).
  const { data: updated, error: updateError } = await supabase
    .from('rooms')
    .update({ is_active: false, closed_by_name: displayName })
    .eq('id', roomId)
    .eq('is_active', true)
    .select('id')

  if (updateError) {
    console.error('[close-room] update error:', updateError)
    return { success: false, error: 'Failed to close room.' }
  }

  if (!updated || updated.length === 0) {
    // Room not found or already closed — safe no-op
    return { success: false, error: 'Room not found or already closed.' }
  }

  // Hard-delete: CASCADE removes all messages
  const { error: deleteError } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)

  if (deleteError) {
    // Dangling soft-close: room is already effectively closed (clients redirected by realtime).
    // Not a user-facing error — log and return success since the close already propagated.
    console.error('[close-room] delete error (dangling soft-close):', deleteError)
  }

  return { success: true }
}
