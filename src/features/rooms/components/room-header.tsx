'use client'

import { MoreVertical, LogOut, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RoomTypeBadge } from './room-type-badge'
import { CopyLinkButton } from './copy-link-button'
import type { RoomPublic } from '../types/room.types'

interface RoomHeaderProps {
  room: RoomPublic
  onLeaveRoom?: () => void
  onCloseRoom?: () => void
  isClosing?: boolean
}

export function RoomHeader({ room, onLeaveRoom, onCloseRoom, isClosing }: RoomHeaderProps) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const showMenu = onLeaveRoom || onCloseRoom

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg font-semibold truncate">{room.name}</h1>
        <RoomTypeBadge type={room.room_type as 'open' | 'secured'} />
      </div>
      <div className="flex items-center gap-2">
        <CopyLinkButton slug={room.slug} />

        {showMenu && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isClosing}
                className="inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <MoreVertical className="w-4 h-4" />
                <span className="sr-only">Room actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onLeaveRoom && (
                  <DropdownMenuItem
                    onClick={onLeaveRoom}
                    className="cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave room
                  </DropdownMenuItem>
                )}
                {onLeaveRoom && onCloseRoom && <DropdownMenuSeparator />}
                {onCloseRoom && (
                  <DropdownMenuItem
                    onClick={() => setCloseDialogOpen(true)}
                    className="cursor-pointer text-red-500 focus:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Close room
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {onCloseRoom && (
              <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
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
          </>
        )}
      </div>
    </header>
  )
}
