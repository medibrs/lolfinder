'use client'

import { cn } from '@/lib/utils'
import { ChatMessageItem } from '@/components/chat-message-persistent'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import {
  type ChatMessage,
  useRealtimeChat,
} from '@/hooks/use-realtime-chat-persistent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RealtimeChatPersistentProps {
  roomName: string
  username?: string
  onMessage?: (messages: ChatMessage[]) => void
  messages?: ChatMessage[]
  enablePersistence?: boolean
  maxHeight?: string
}

/**
 * Realtime chat component with database persistence
 * @param roomName - The name of the room to join. Each room is a unique chat.
 * @param username - The username of the user (optional, will use current user if not provided)
 * @param onMessage - The callback function to handle the messages
 * @param messages - The messages to display in the chat (optional, will use database if not provided)
 * @param enablePersistence - Whether to save messages to database (default: true)
 * @param showClearHistory - Whether to show clear history button (default: false)
 * @param maxHeight - Maximum height of chat messages container (default: "400px")
 * @returns The chat component
 */
export const RealtimeChatPersistent = ({
  roomName,
  username,
  onMessage,
  messages: propMessages,
  enablePersistence = true,
  maxHeight = "400px"
}: RealtimeChatPersistentProps) => {
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profileIconId, setProfileIconId] = useState<number | undefined>(undefined)

  // Load current user on mount
  useEffect(() => {
    const loadCurrentUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      // Fetch user's profile data from players table (summoner name and profile icon)
      if (user) {
        const { data: playerData } = await supabase
          .from('players')
          .select('summoner_name, profile_icon_id')
          .eq('id', user.id)
          .single()
        
        if (playerData) {
          setProfileIconId(playerData.profile_icon_id)
        }
      }
    }
    loadCurrentUser()
  }, [])

  // Use provided username or fall back to current user's summoner name from player profile
  const chatUsername = username || 'Player' // Never expose real names, only use provided username or generic fallback

  const {
    messages: hookMessages,
    sendMessage,
    deleteMessage,
    isConnected,
    isLoading
  } = useRealtimeChat({
    roomName,
    username: chatUsername,
    userId: currentUser?.id,
    profileIconId: profileIconId,
    enablePersistence
  })

  // Use provided messages or hook messages
  const messages = propMessages || hookMessages

  const { containerRef: messagesEndRef, scrollToBottom } = useChatScroll()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim()) return

      await sendMessage(newMessage.trim())
      setNewMessage('')
    },
    [newMessage, sendMessage]
  )

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    await deleteMessage(messageId)
  }, [deleteMessage])

  // Call onMessage callback when messages change
  useEffect(() => {
    onMessage?.(messages)
  }, [messages, onMessage])

  const canDeleteMessages = enablePersistence && currentUser

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {enablePersistence && (
            <div className="flex items-center gap-1">
              <History className="h-3 w-3" />
              <span className="text-sm text-muted-foreground">
                {messages.length} messages
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ maxHeight }}
        ref={messagesEndRef}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              isOwn={message.user.id === currentUser?.id}
              canDelete={canDeleteMessages}
              onDelete={() => handleDeleteMessage(message.id)}
            />
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              isConnected 
                ? `Message as ${chatUsername}...` 
                : 'Connecting...'
            }
            disabled={!isConnected}
            maxLength={1000}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!isConnected || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {newMessage.length > 800 && (
          <p className="text-xs text-muted-foreground mt-1">
            {newMessage.length}/1000 characters
          </p>
        )}
      </form>
    </div>
  )
}
