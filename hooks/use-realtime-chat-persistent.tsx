'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface UseRealtimeChatProps {
  roomName: string
  username: string
  userId?: string
  profileIconId?: number // LoL profile icon ID
  enablePersistence?: boolean
}

export interface ChatMessage {
  id: string
  content: string
  user: {
    name: string
    id?: string
    profileIconId?: number // LoL profile icon ID
  }
  createdAt: string
}

const EVENT_MESSAGE_TYPE = 'message'
const EVENT_DELETE_TYPE = 'message_deleted'

export function useRealtimeChat({ 
  roomName, 
  username, 
  userId,
  profileIconId,
  enablePersistence = true 
}: UseRealtimeChatProps) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(enablePersistence)

  // Load message history from database
  const loadMessageHistory = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Start with a simple query without joins to avoid permission issues
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_name', roomName)
        .order('created_at', { ascending: true })
        .limit(50) // Load last 50 messages

      if (error) {
        console.error('Database error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // If table doesn't exist, that's ok - start with empty messages
        if (error.code === 'PGRST116') {
          console.log('Chat messages table not found, starting fresh')
          setMessages([])
          setIsLoading(false)
          return
        }
        
        console.error('Error loading chat history:', error)
        setMessages([])
        setIsLoading(false)
        return
      }

      if (data) {
        // Get unique user IDs from messages to fetch their profile icons
        const userIds = [...new Set(data.map(msg => msg.user_id).filter(Boolean))]
        const profileIconMap = new Map()

        // Fetch profile icons for all users in batch
        if (userIds.length > 0) {
          const { data: playerData } = await supabase
            .from('players')
            .select('id, profile_icon_id')
            .in('id', userIds)

          if (playerData) {
            playerData.forEach(player => {
              profileIconMap.set(player.id, player.profile_icon_id)
            })
          }
        }

        const formattedMessages: ChatMessage[] = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          user: {
            name: msg.user_name,
            id: msg.user_id,
            profileIconId: msg.user_id ? profileIconMap.get(msg.user_id) : undefined
          },
          createdAt: msg.created_at
        }))
        setMessages(formattedMessages)
        console.log(`Loaded ${formattedMessages.length} messages for room: ${roomName}`)
      }
    } catch (error) {
      console.error('Unexpected error loading message history:', error)
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase, roomName])

  // Load message history from database when component mounts
  useEffect(() => {
    if (enablePersistence) {
      loadMessageHistory()
    }
  }, [enablePersistence, loadMessageHistory])

  // Reconnection logic
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY_MS = 3000

  const reconnect = useCallback(async () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached')
      return
    }

    console.log(`Attempting to reconnect... (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
    setReconnectAttempts(prev => prev + 1)

    // Remove old channel if exists
    if (channel) {
      await supabase.removeChannel(channel)
    }

    // Create new channel and subscribe
    const newChannel = supabase.channel(roomName)
    
    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const newMessage = payload.payload as ChatMessage
        setMessages((current) => {
          // Avoid duplicate messages
          if (current.some(msg => msg.id === newMessage.id)) {
            return current
          }
          return [...current, newMessage]
        })
      })
      .on('broadcast', { event: EVENT_DELETE_TYPE }, (payload) => {
        const { messageId } = payload.payload as { messageId: string }
        setMessages((current) => 
          current.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: 'Message deleted' }
              : msg
          )
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setReconnectAttempts(0) // Reset on successful connection
          console.log('Reconnected successfully!')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)
  }, [channel, roomName, supabase, reconnectAttempts])

  // Auto-reconnect when disconnected
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null

    if (!isConnected && channel && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // Wait before attempting reconnection
      reconnectTimer = setTimeout(() => {
        reconnect()
      }, RECONNECT_DELAY_MS)
    }

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
    }
  }, [isConnected, channel, reconnectAttempts, reconnect])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network came back online, attempting to reconnect...')
      setReconnectAttempts(0) // Reset attempts when network comes back
      reconnect()
    }

    const handleOffline = () => {
      console.log('Network went offline')
      setIsConnected(false)
    }

    // Handle visibility change (tab becomes active again)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        console.log('Tab became visible, checking connection...')
        setReconnectAttempts(0)
        reconnect()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isConnected, reconnect])

  // Initial channel setup
  useEffect(() => {
    const newChannel = supabase.channel(roomName)

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const newMessage = payload.payload as ChatMessage
        setMessages((current) => {
          // Avoid duplicate messages
          if (current.some(msg => msg.id === newMessage.id)) {
            return current
          }
          return [...current, newMessage]
        })
      })
      .on('broadcast', { event: EVENT_DELETE_TYPE }, (payload) => {
        const { messageId } = payload.payload as { messageId: string }
        // Update the message content to "Message deleted" for all users
        setMessages((current) => 
          current.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: 'Message deleted' }
              : msg
          )
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setReconnectAttempts(0)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [roomName, supabase])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return

      if (!content.trim()) return // Don't send empty messages

      const tempId = crypto.randomUUID() // Temporary ID for optimistic update
      
      const message: ChatMessage = {
        id: tempId,
        content: content.trim(),
        user: {
          name: username,
          id: userId,
          profileIconId: profileIconId
        },
        createdAt: new Date().toISOString(),
      }

      // Update local state immediately for the sender (optimistic update)
      setMessages((current) => [...current, message])

      try {
        let finalMessageId = tempId

        // Save to database first if persistence is enabled to get the real ID
        if (enablePersistence) {
          try {
            const { data, error } = await supabase
              .from('chat_messages')
              .insert({
                room_name: roomName,
                content: message.content,
                user_name: message.user.name,
                user_id: userId
              })
              .select('id')
              .single()

            if (error) {
              // If table doesn't exist, just log and continue - real-time still works
              if (error.code === 'PGRST116') {
                console.log('Chat messages table not available - messages will be real-time only')
              } else {
                console.error('Error saving message to database:', error)
              }
            } else if (data) {
              // Use the database-generated ID
              finalMessageId = data.id
              // Update local state with the real database ID
              setMessages((current) => 
                current.map(msg => 
                  msg.id === tempId 
                    ? { ...msg, id: finalMessageId }
                    : msg
                )
              )
            }
          } catch (dbError) {
            console.error('Database error:', dbError)
            // Continue with real-time functionality even if DB fails
          }
        }

        // Send via broadcast for real-time delivery with the final ID
        await channel.send({
          type: 'broadcast',
          event: EVENT_MESSAGE_TYPE,
          payload: { ...message, id: finalMessageId },
        })
      } catch (error) {
        console.error('Error sending message:', error)
        // Remove the message from local state if it failed to send
        setMessages((current) => current.filter(msg => msg.id !== tempId))
      }
    },
    [channel, isConnected, username, userId, profileIconId, roomName, enablePersistence, supabase]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!channel || !isConnected) return

      try {
        // Update message content to "Message deleted" in database
        if (enablePersistence) {
          const { data, error } = await supabase
            .from('chat_messages')
            .update({ content: 'Message deleted' })
            .eq('id', messageId)
            .select()

          if (error) {
            if (error.code !== 'PGRST116') {
              console.error('Error deleting message from database:', error)
            }
          } else {
            console.log('Message deleted from database:', messageId, data)
          }
        }

        // Broadcast delete event to all users in the room
        await channel.send({
          type: 'broadcast',
          event: EVENT_DELETE_TYPE,
          payload: { messageId }
        })

        // Update local state to show "Message deleted"
        setMessages((current) => 
          current.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: 'Message deleted' }
              : msg
          )
        )
      } catch (error) {
        console.error('Error deleting message:', error)
        // Still update local state
        setMessages((current) => 
          current.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: 'Message deleted' }
              : msg
          )
        )
      }
    },
    [channel, isConnected, enablePersistence, supabase]
  )

  return { 
    messages, 
    sendMessage, 
    deleteMessage,
    isConnected, 
    isLoading,
    isReconnecting: !isConnected && reconnectAttempts > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS
  }
}
