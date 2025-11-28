import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-realtime-chat-persistent'
import { Button } from '@/components/ui/button'
import { Trash2, MoreHorizontal } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getProfileIconUrl } from '@/lib/ddragon'
import Image from 'next/image'

interface ChatMessageItemProps {
  message: ChatMessage
  isOwn?: boolean
  showHeader?: boolean
  canDelete?: boolean
  onDelete?: () => void
}

export const ChatMessageItem = ({ 
  message, 
  isOwn = false, 
  showHeader = true, 
  canDelete = false,
  onDelete 
}: ChatMessageItemProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string>('/default-avatar.svg') // Fallback avatar

  useEffect(() => {
    const loadAvatar = async () => {
      if (message.user.profileIconId) {
        try {
          const url = await getProfileIconUrl(message.user.profileIconId)
          setAvatarUrl(url)
        } catch (error) {
          console.error('Error loading profile icon:', error)
          // Keep fallback avatar
        }
      }
    }
    loadAvatar()
  }, [message.user.profileIconId])

  const handleDelete = () => {
    onDelete?.()
  }

  const isDeleted = message.content === 'Message deleted'

  return (
    <div className={`flex mt-2 gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="flex-shrink-0 flex items-end">
          <Image
            src={avatarUrl}
            alt={message.user.name}
            width={40}
            height={40}
            className="rounded-full"
            onError={(e) => {
              // Fallback to default avatar on error
              const target = e.target as HTMLImageElement
              target.src = '/default-avatar.svg'
            }}
          />
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
            {/* Delete button inline with header for own messages */}
            {canDelete && isOwn && !isDeleted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm',
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            isDeleted && 'italic opacity-60'
          )}
        >
          {message.content}
        </div>
      </div>

      {isOwn && (
        <div className="flex-shrink-0 flex items-end">
          <Image
            src={avatarUrl}
            alt={message.user.name}
            width={40}
            height={40}
            className="rounded-full"
            onError={(e) => {
              // Fallback to default avatar on error
              const target = e.target as HTMLImageElement
              target.src = '/default-avatar.svg'
            }}
          />
        </div>
      )}
    </div>
  )
}
