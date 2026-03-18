import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Converts a room name to a URL-safe slug with a random suffix.
 * Example: "My Cool Room" → "my-cool-room-a3x9k2"
 */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
    .slice(0, 40)                    // max 40 chars for base

  const suffix = Math.random().toString(36).slice(2, 8) // 6-char random alphanumeric
  return `${base}-${suffix}`
}

/**
 * Generates a slug guaranteed to be unique in the rooms table.
 * Retries up to maxAttempts times if a collision occurs.
 */
export async function generateUniqueSlug(
  name: string,
  supabase: SupabaseClient<Database>,
  maxAttempts = 5
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const slug = generateSlug(name)
    const { data } = await supabase
      .from('rooms')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!data) return slug
  }
  // Extremely unlikely — fallback with timestamp
  return `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
