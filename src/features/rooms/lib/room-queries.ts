import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { RoomPublic } from '../types/room.types'

/**
 * Fetches a room by slug WITHOUT the secret_code_hash.
 * Safe to use in server components and pass to client components.
 */
export async function getRoomBySlug(
  slug: string,
  supabase: SupabaseClient<Database>
): Promise<RoomPublic | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, slug, name, room_type, created_at, updated_at, created_by_guest_id, is_active, closed_by_name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[room-queries] getRoomBySlug error:', error)
    return null
  }
  return data
}

/**
 * Fetches a room by slug INCLUDING the secret_code_hash.
 * Admin/server-only — used for join validation. Never expose to client.
 */
export async function getRoomForValidation(
  slug: string,
  supabase: SupabaseClient<Database>
): Promise<Database['public']['Tables']['rooms']['Row'] | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, slug, name, room_type, secret_code_hash, created_at, updated_at, created_by_guest_id, is_active, closed_by_name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[room-queries] getRoomForValidation error:', error)
    return null
  }
  return data
}
