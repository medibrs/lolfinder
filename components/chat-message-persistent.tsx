import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-realtime-chat-persistent'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getProfileIconUrl } from '@/lib/ddragon'
import Image from 'next/image'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwn?: boolean
  showHeader?: boolean
  showAvatar?: boolean
  canDelete?: boolean
  onDelete?: () => void
}

export const ChatMessageItem = ({ 
  message, 
  isOwn = false, 
  showHeader = true,
  showAvatar = true,
  canDelete = false,
  onDelete 
}: ChatMessageItemProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string>('/default-avatar.svg')
  const [showDeleteButton, setShowDeleteButton] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)

  useEffect(() => {
    const loadAvatar = async () => {
      if (message.user.profileIconId) {
        try {
          const url = await getProfileIconUrl(message.user.profileIconId)
          setAvatarUrl(url)
        } catch (error) {
          console.error('Error loading profile icon:', error)
        }
      }
    }
    loadAvatar()
  }, [message.user.profileIconId])

  const handleDelete = () => {
    onDelete?.()
    setShowDeleteButton(false)
  }

  const isDeleted = message.content === 'Message deleted'

  // Long press handlers for mobile
  const handleTouchStart = useCallback(() => {
    if (!canDelete || !isOwn || isDeleted) return
    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setShowDeleteButton(true)
    }, 500) // 500ms long press
  }, [canDelete, isOwn, isDeleted])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Hide delete button when clicking outside
  const handleClickOutside = useCallback(() => {
    if (showDeleteButton) {
      setShowDeleteButton(false)
    }
  }, [showDeleteButton])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  return (
    <div 
      className={`flex ${showAvatar ? 'mt-4' : 'mt-1'} gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
      onClick={handleClickOutside}
    >
      {!isOwn && (
        <div className="flex-shrink-0 flex items-end w-10">
          {showAvatar && (
            <Image
              src={avatarUrl}
              alt={message.user.name}
              width={40}
              height={40}
              className="rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/default-avatar.svg'
              }}
            />
          )}
        </div>
      )}
      
      <div className="flex flex-col gap-1 max-w-[75%]">
        {showHeader && (
          <div
            className={cn('flex items-center gap-2 text-xs px-1', {
              'justify-end flex-row-reverse': isOwn,
            })}
          >
            <span className={'font-medium text-muted-foreground'}>{message.user.name}</span>
            <span className="text-muted-foreground">
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm relative group',
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            isDeleted && 'italic opacity-60'
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          {message.content}
          
          {/* Delete button - shows on hover (desktop) or long press (mobile) */}
          {canDelete && isOwn && !isDeleted && (
            <div 
              className={cn(
                'absolute -top-2 -right-2 transition-opacity',
                // Desktop: show on hover
                'md:opacity-0 md:group-hover:opacity-100',
                // Mobile: show on long press
                showDeleteButton ? 'opacity-100' : 'opacity-0 md:opacity-0'
              )}
            >
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {isOwn && (
        <div className="flex-shrink-0 flex items-end w-10">
          {showAvatar && (
            <Image
              src={avatarUrl}
              alt={message.user.name}
              width={40}
              height={40}
              className="rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/default-avatar.svg'
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
