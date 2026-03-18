'use server'

import { headers } from 'next/headers'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createRoomSchema } from '../schemas/room.schema'
import { generateUniqueSlug } from '@/lib/utils/slug'
import { hashCode } from '@/lib/security/hash'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { CreateRoomResult } from '../types/room.types'

export async function createRoom(
  input: unknown,
  guestId: string
): Promise<CreateRoomResult> {
  // 1. Validate input
  const parsed = createRoomSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { name, room_type, secret_code } = parsed.data

  // 2. Get IP for rate limiting
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  // 3. Rate limit: 5 room creations per IP per hour
  const supabaseAdmin = getSupabaseAdminClient()
  const rateLimit = await checkRateLimit(
    `create_room:ip:${ip}`,
    5,
    3600,
    supabaseAdmin
  )
  if (!rateLimit.allowed) {
    return { success: false, error: 'Too many rooms created. Please try again later.' }
  }

  // 4. Generate unique slug
  const slug = await generateUniqueSlug(name, supabaseAdmin)

  // 5. Hash secret code if secured
  const secretCodeHash =
    room_type === 'secured' && secret_code
      ? await hashCode(secret_code)
      : null

  // 6. Insert room
  const { error } = await supabaseAdmin.from('rooms').insert({
    slug,
    name: name.trim(),
    room_type,
    secret_code_hash: secretCodeHash,
    created_by_guest_id: guestId || null,
    is_active: true,
  })

  if (error) {
    console.error('[create-room] insert error:', error)
    return { success: false, error: 'Failed to create room. Please try again.' }
  }

  return { success: true, slug }
}
