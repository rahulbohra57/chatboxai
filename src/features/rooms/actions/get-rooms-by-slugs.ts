'use server'

import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const getRoomsBySlugsSchema = z.object({
  slugs: z.array(z.string()).max(20),
})

export type RoomStatus = {
  id: string
  slug: string
  name: string
  room_type: 'open' | 'secured'
  is_active: boolean
}

export type GetRoomsBySlugsResult =
  | { success: true; rooms: RoomStatus[] }
  | { success: false; error: string }

export async function getRoomsBySlugs(
  slugs: string[]
): Promise<GetRoomsBySlugsResult> {
  const parsed = getRoomsBySlugsSchema.safeParse({ slugs })
  if (!parsed.success) {
    return { success: false, error: 'Invalid input.' }
  }

  if (slugs.length === 0) {
    return { success: true, rooms: [] }
  }

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('rooms')
    .select('id, slug, name, room_type, is_active')
    .in('slug', slugs)
    .eq('is_active', true)

  if (error) {
    console.error('[get-rooms-by-slugs] error:', error)
    return { success: false, error: 'Failed to fetch rooms.' }
  }

  return { success: true, rooms: data as RoomStatus[] }
}
