'use client'

import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { RoomTypeBadge } from './room-type-badge'
import { CopyLinkButton } from './copy-link-button'
import type { RoomPublic } from '../types/room.types'

interface RoomHeaderProps {
  room: RoomPublic
  onCloseRoom?: () => void
  isClosing?: boolean
}

export function RoomHeader({ room, onCloseRoom, isClosing }: RoomHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg font-semibold truncate">{room.name}</h1>
        <RoomTypeBadge type={room.room_type as 'open' | 'secured'} />
      </div>
      <div className="flex items-center gap-2">
        <CopyLinkButton slug={room.slug} />
        {onCloseRoom && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  disabled={isClosing}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {isClosing ? 'Closing…' : 'Close room'}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close this room?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the room and all its messages.
                  Everyone will be removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCloseRoom}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Close room
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </header>
  )
}
