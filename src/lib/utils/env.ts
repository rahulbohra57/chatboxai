// Validates and exports typed env vars
// Throws at startup if required vars are missing

const isTest = process.env.NODE_ENV === 'test'
const isServer = typeof window === 'undefined'

function requireEnv(name: string, value: string | undefined): string {
  if (!isTest && !value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value ?? ''
}

const required = {
  NEXT_PUBLIC_APP_URL: requireEnv(
    'NEXT_PUBLIC_APP_URL',
    process.env.NEXT_PUBLIC_APP_URL
  ),
  NEXT_PUBLIC_SUPABASE_URL: requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
} as const

const serverOnly = {
  SUPABASE_SERVICE_ROLE_KEY: isServer
    ? requireEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : '',
} as const

export const env = { ...required, ...serverOnly }
