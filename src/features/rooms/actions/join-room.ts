'use server'

import { headers } from 'next/headers'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { joinRoomSchema } from '../schemas/room.schema'
import { getRoomForValidation } from '../lib/room-queries'
import { compareCode } from '@/lib/security/hash'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { JoinRoomResult } from '../types/room.types'

export async function joinRoom(
  slug: string,
  input: unknown
): Promise<JoinRoomResult> {
  // 1. Validate input
  const parsed = joinRoomSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { secret_code } = parsed.data

  // 2. Get IP for rate limiting
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  // 3. Fetch room (with hash) using admin client
  const supabaseAdmin = getSupabaseAdminClient()
  const room = await getRoomForValidation(slug, supabaseAdmin)

  if (!room) {
    return { success: false, error: 'Room not found or no longer active.' }
  }

  // 4. For secured rooms: rate limit and validate code
  if (room.room_type === 'secured') {
    const rateLimit = await checkRateLimit(
      `join_attempt:ip:${ip}:slug:${slug}`,
      10,
      900, // 15 minutes
      supabaseAdmin
    )
    if (!rateLimit.allowed) {
      return { success: false, error: 'Too many join attempts. Please try again later.' }
    }

    if (!secret_code) {
      return { success: false, error: 'Secret code is required.' }
    }

    if (!room.secret_code_hash) {
      return { success: false, error: 'Room configuration error.' }
    }

    const codeValid = await compareCode(secret_code, room.secret_code_hash)
    if (!codeValid) {
      return { success: false, error: 'Incorrect secret code.' }
    }
  }

  return { success: true }
}
