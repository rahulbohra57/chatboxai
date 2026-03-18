import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))

import { hashCode, compareCode } from '@/lib/security/hash'

describe('hashCode', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashCode('mysecret')
    expect(hash).toMatch(/^\$2[ab]\$/)
    expect(hash.length).toBeGreaterThan(30)
  })

  it('produces different hashes for the same input (salt)', async () => {
    const hash1 = await hashCode('mysecret')
    const hash2 = await hashCode('mysecret')
    expect(hash1).not.toBe(hash2)
  })
})

describe('compareCode', () => {
  it('returns true for correct code', async () => {
    const hash = await hashCode('correctcode')
    expect(await compareCode('correctcode', hash)).toBe(true)
  })

  it('returns false for incorrect code', async () => {
    const hash = await hashCode('correctcode')
    expect(await compareCode('wrongcode', hash)).toBe(false)
  })

  it('returns false for empty string', async () => {
    const hash = await hashCode('correctcode')
    expect(await compareCode('', hash)).toBe(false)
  })
})
