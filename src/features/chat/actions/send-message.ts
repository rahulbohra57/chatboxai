'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendMessageSchema } from '../schemas/message.schema'
import { sanitizeMessage } from '@/lib/security/sanitize'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { SendMessageResult } from '../types/message.types'

export async function sendMessage(input: unknown): Promise<SendMessageResult> {
  // 1. Validate
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { room_id, sender_guest_id, sender_name, body } = parsed.data

  // 2. Rate limit: 30 messages per guest per minute
  const supabaseAdmin = getSupabaseAdminClient()
  const rateLimit = await checkRateLimit(
    `send_message:guest:${sender_guest_id}`,
    30,
    60,
    supabaseAdmin
  )
  if (!rateLimit.allowed) {
    return { success: false, error: 'Sending too fast. Please wait a moment.' }
  }

  // 3. Sanitize
  const sanitizedBody = sanitizeMessage(body)
  if (!sanitizedBody) {
    return { success: false, error: 'Message cannot be empty.' }
  }

  // 4. Insert
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      room_id,
      sender_guest_id,
      sender_name: sender_name.trim(),
      body: sanitizedBody,
    })
    .select('id, room_id, sender_guest_id, sender_name, body, created_at')
    .single()

  if (error || !data) {
    console.error('[send-message] insert error:', error)
    return { success: false, error: 'Failed to send message. Please try again.' }
  }

  return { success: true, message: data }
}
