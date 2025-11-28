'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'

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

export function useRealtimeChat({ 
  roomName, 
  username, 
  userId,
  profileIconId,
  enablePersistence = true 
}: UseRealtimeChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(enablePersistence)

  // Load message history from database when component mounts
  useEffect(() => {
    if (enablePersistence) {
      loadMessageHistory()
    }
  }, [roomName, enablePersistence])

  const loadMessageHistory = async () => {
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
  }

  useEffect(() => {
    const newChannel = supabase.channel(roomName)

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        const newMessage = payload.payload as ChatMessage
        setMessages((current) => [...current, newMessage])
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      supabase.removeChannel(newChannel)
    }
  }, [roomName, username, profileIconId, supabase])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channel || !isConnected) return

      if (!content.trim()) return // Don't send empty messages

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        content: content.trim(),
        user: {
          name: username,
          id: userId,
          profileIconId: profileIconId
        },
        createdAt: new Date().toISOString(),
      }

      // Update local state immediately for the sender
      setMessages((current) => [...current, message])

      try {
        // Send via broadcast for real-time delivery
        await channel.send({
          type: 'broadcast',
          event: EVENT_MESSAGE_TYPE,
          payload: message,
        })

        // Save to database if persistence is enabled
        if (enablePersistence) {
          try {
            const { error } = await supabase
              .from('chat_messages')
              .insert({
                room_name: roomName,
                content: message.content,
                user_name: message.user.name,
                user_id: userId
              })

            if (error) {
              // If table doesn't exist, just log and continue - real-time still works
              if (error.code === 'PGRST116') {
                console.log('Chat messages table not available - messages will be real-time only')
              } else {
                console.error('Error saving message to database:', error)
              }
            }
          } catch (dbError) {
            console.error('Database error:', dbError)
            // Continue with real-time functionality even if DB fails
          }
        }
      } catch (error) {
        console.error('Error sending message:', error)
        // Remove the message from local state if it failed to send
        setMessages((current) => current.filter(msg => msg.id !== message.id))
      }
    },
    [channel, isConnected, username, userId, profileIconId, roomName, enablePersistence]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!enablePersistence) return

      try {
        // Delete from database
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', messageId)

        if (error) {
          // If table doesn't exist, just remove from local state
          if (error.code === 'PGRST116') {
            console.log('Chat messages table not available - removing from local view only')
          } else {
            console.error('Error deleting message:', error)
          }
          // Still remove from local state even if DB fails
        }

        // Remove from local state
        setMessages((current) => current.filter(msg => msg.id !== messageId))
      } catch (error) {
        console.error('Error deleting message:', error)
        // Still remove from local state
        setMessages((current) => current.filter(msg => msg.id !== messageId))
      }
    },
    [enablePersistence]
  )

  const clearHistory = useCallback(
    async () => {
      if (!enablePersistence) return

      try {
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('room_name', roomName)

        if (error) {
          // If table doesn't exist, just clear local state
          if (error.code === 'PGRST116') {
            console.log('Chat messages table not available - clearing local view only')
          } else {
            console.error('Error clearing chat history:', error)
          }
          // Still clear local state even if DB fails
        }

        setMessages([])
      } catch (error) {
        console.error('Error clearing chat history:', error)
        // Still clear local state
        setMessages([])
      }
    },
    [enablePersistence, roomName]
  )

  return { 
    messages, 
    sendMessage, 
    deleteMessage,
    clearHistory,
    isConnected, 
    isLoading 
  }
}
