import { describe, it, expect } from 'vitest'
import { sanitizeMessage } from '@/lib/security/sanitize'

describe('sanitizeMessage', () => {
  it('passes through plain text unchanged', () => {
    expect(sanitizeMessage('Hello world')).toBe('Hello world')
  })

  it('strips HTML tags', () => {
    expect(sanitizeMessage('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('strips HTML tags from message', () => {
    expect(sanitizeMessage('<b>Bold</b> text')).toBe('Bold text')
  })

  it('decodes HTML entities', () => {
    expect(sanitizeMessage('&lt;hello&gt;')).toBe('<hello>')
    expect(sanitizeMessage('A &amp; B')).toBe('A & B')
  })

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeMessage('  hello  ')).toBe('hello')
  })

  it('preserves newlines in multiline messages', () => {
    const msg = 'Line 1\nLine 2\nLine 3'
    expect(sanitizeMessage(msg)).toBe(msg)
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeMessage('')).toBe('')
  })
})
