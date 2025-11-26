"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notificationManager } from '@/lib/browser-notifications'
import { faviconBadge } from '@/lib/favicon-badge'

export function useRealtimeNotifications(userId: string | null, limit: number = 10) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    // Initial load
    loadNotifications()

    // Set up real-time subscription
    const channel = supabase
      .channel(`global-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log('New notification received:', payload.new)
          
          // Add to state
          const newNotification = payload.new as any
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(prev => {
            const newCount = prev + 1
            console.log('🏷️ Updating favicon badge to:', newCount)
            faviconBadge.setBadge(newCount)
            return newCount
          })
          
          // Send browser notification
          try {
            const notificationContent = notificationManager.getNotificationContent(newNotification)
            console.log('Sending browser notification:', notificationContent)
            const success = await notificationManager.showNotification(notificationContent)
            console.log('Browser notification sent:', success)
          } catch (error) {
            console.error('Error sending browser notification:', error)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updatedNotification = payload.new as any
          setNotifications(prev => 
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          )
          
          // Update unread count and favicon
          if (updatedNotification.read) {
            setUnreadCount(prev => {
              const newCount = Math.max(0, prev - 1)
              faviconBadge.setBadge(newCount)
              return newCount
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, limit])

  // Update favicon badge when unread count changes
  useEffect(() => {
    faviconBadge.setBadge(unreadCount)
  }, [unreadCount])

  // Clear favicon badge when user logs out
  useEffect(() => {
    if (!userId) {
      faviconBadge.clear()
    }
  }, [userId])

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error loading notifications:', error)
        return
      }

      setNotifications(data || [])
      const unreadCount = data?.filter(n => !n.read).length || 0
      setUnreadCount(unreadCount)
      faviconBadge.setBadge(unreadCount)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) {
        console.error('Error marking notification as read:', error)
        return false
      }

      setUnreadCount(prev => {
        const newCount = Math.max(0, prev - 1)
        faviconBadge.setBadge(newCount)
        return newCount
      })
      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        return false
      }

      setUnreadCount(0)
      faviconBadge.setBadge(0)
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) {
        console.error('Error deleting notification:', error)
        return false
      }

      // Remove from state and update unread count if needed
      setNotifications(prev => {
        const deletedNotification = prev.find(n => n.id === notificationId)
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount(current => {
            const newCount = Math.max(0, current - 1)
            faviconBadge.setBadge(newCount)
            return newCount
          })
        }
        return prev.filter(n => n.id !== notificationId)
      })
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadNotifications
  }
}
