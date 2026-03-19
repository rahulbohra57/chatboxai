'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

function extractSlug(input: string): string {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.at(-1) ?? trimmed
  } catch {
    return trimmed
  }
}

export function JoinRoomInput() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleJoin = () => {
    const slug = extractSlug(value)
    if (!slug) {
      setError('Enter a room link or ID')
      return
    }
    router.push(`/room/${slug}`)
  }

  return (
    <div className="w-full max-w-sm space-y-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="Room link or ID"
          className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleJoin}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
        >
          Join
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
