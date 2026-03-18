import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

/**
 * Checks and increments a rate limit counter.
 *
 * @param key - Unique identifier for this limit (e.g. "create_room:ip:1.2.3.4")
 * @param limit - Max requests allowed per window
 * @param windowSeconds - Window size in seconds
 * @param supabase - Admin Supabase client (needs to write to rate_limits table)
 * @returns { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  supabase: SupabaseClient<Database>
): Promise<RateLimitResult> {
  try {
    const windowStart = new Date(
      Math.floor(Date.now() / (windowSeconds * 1000)) * (windowSeconds * 1000)
    ).toISOString()

    // Try to find existing record for this key+window
    const { data: existing } = await supabase
      .from('rate_limits')
      .select('id, count')
      .eq('key', key)
      .eq('window_start', windowStart)
      .maybeSingle()

    if (!existing) {
      // First request in this window — insert
      await supabase.from('rate_limits').insert({
        key,
        window_start: windowStart,
        count: 1,
      })
      return { allowed: true, remaining: limit - 1 }
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0 }
    }

    // Increment counter
    await supabase
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id)

    return { allowed: true, remaining: limit - existing.count - 1 }
  } catch (error) {
    // Fail open: if rate limiting itself errors, allow the request
    console.error('[rate-limit] error:', error)
    return { allowed: true, remaining: limit }
  }
}
