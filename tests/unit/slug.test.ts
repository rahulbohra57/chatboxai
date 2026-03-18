import { describe, it, expect } from 'vitest'
import { generateSlug } from '@/lib/utils/slug'

describe('generateSlug', () => {
  it('converts name to lowercase slug with suffix', () => {
    const slug = generateSlug('My Cool Room')
    expect(slug).toMatch(/^my-cool-room-[a-z0-9]{6}$/)
  })

  it('removes special characters', () => {
    const slug = generateSlug('Room #1 (test)!')
    expect(slug).not.toMatch(/[#!()]/)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('collapses multiple spaces and hyphens', () => {
    const slug = generateSlug('Hello   World')
    expect(slug).toMatch(/^hello-world-[a-z0-9]{6}$/)
  })

  it('produces different slugs on each call (random suffix)', () => {
    const slug1 = generateSlug('Test Room')
    const slug2 = generateSlug('Test Room')
    expect(slug1).not.toBe(slug2)
  })

  it('handles empty string gracefully', () => {
    const slug = generateSlug('')
    // Should produce just a suffix or a valid slug
    expect(slug.length).toBeGreaterThan(0)
    expect(slug).toMatch(/^[a-z0-9-]*$/)
  })

  it('truncates very long names to max 40 chars base', () => {
    const longName = 'A'.repeat(100)
    const slug = generateSlug(longName)
    const base = slug.replace(/-[a-z0-9]{6}$/, '')
    expect(base.length).toBeLessThanOrEqual(40)
  })
})
