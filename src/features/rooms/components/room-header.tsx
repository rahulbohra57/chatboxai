import { RoomTypeBadge } from './room-type-badge'
import { CopyLinkButton } from './copy-link-button'
import type { RoomPublic } from '../types/room.types'

interface RoomHeaderProps {
  room: RoomPublic
}

export function RoomHeader({ room }: RoomHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg font-semibold truncate">{room.name}</h1>
        <RoomTypeBadge type={room.room_type as 'open' | 'secured'} />
      </div>
      <CopyLinkButton slug={room.slug} />
    </header>
  )
}
