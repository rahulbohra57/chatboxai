'use client'

import type { RoomType } from '../types/room.types'

interface RoomTypeBadgeProps {
  type: RoomType
  className?: string
}

export function RoomTypeBadge({ type, className }: RoomTypeBadgeProps) {
  if (type === 'open') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ${className ?? ''}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Open
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 ${className ?? ''}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Secured
    </span>
  )
}
