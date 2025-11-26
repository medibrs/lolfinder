"use client"

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notificationManager } from '@/lib/browser-notifications'
import { faviconBadge } from '@/lib/favicon-badge'

const PAGE_SIZE = 20

export function useRealtimeNotifications(userId: string | null, filterType?: string, searchTerm?: string) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const supabase = useMemo(() => createClient(), [])

  // Load initial notifications (first page) with server-side filtering
  const loadNotifications = useCallback(async () => {
    if (!userId) {
      console.log('loadNotifications: No userId, skipping')
      return
    }
    
    console.log('loadNotifications: Starting load for userId:', userId, 'filterType:', filterType, 'searchTerm:', searchTerm)
    setLoading(true)
    setPage(0)
    
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      // Apply server-side type filter
      if (filterType && filterType !== 'all') {
        query = query.eq('type', filterType)
      }
      
      // Apply server-side search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`)
      }
      
      const { data, error, count } = await query.range(0, PAGE_SIZE - 1)

      console.log('loadNotifications: Query result - data:', data?.length, 'error:', error, 'count:', count)

      if (error) {
        console.error('Error loading notifications:', error)
        setLoading(false)
        return
      }

      const notificationsData = data || []
      console.log('loadNotifications: Setting notifications:', notificationsData.length, 'items')
      setNotifications(notificationsData)
      setHasMore(notificationsData.length === PAGE_SIZE && (count || 0) > PAGE_SIZE)
      
      // Calculate unread count from all notifications (not filtered)
      const { data: allNotifications } = await supabase
        .from('notifications')
        .select('read')
        .eq('user_id', userId)
        .eq('read', false)
      
      const unreadCountData = allNotifications?.length || 0
      setUnreadCount(unreadCountData)
      faviconBadge.setBadge(unreadCountData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading notifications:', error)
      setLoading(false)
    }
  }, [userId, supabase, filterType, searchTerm])

  // Load more notifications (next page) with server-side filtering
  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return
    
    setLoadingMore(true)
    const nextPage = page + 1
    const offset = nextPage * PAGE_SIZE
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      // Apply server-side type filter
      if (filterType && filterType !== 'all') {
        query = query.eq('type', filterType)
      }
      
      // Apply server-side search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Error loading more notifications:', error)
        setLoadingMore(false)
        return
      }

      const newNotifications = data || []
      
      if (newNotifications.length > 0) {
        setNotifications(prev => [...prev, ...newNotifications])
        setPage(nextPage)
      }
      
      setHasMore(newNotifications.length === PAGE_SIZE)
      setLoadingMore(false)
    } catch (error) {
      console.error('Error loading more notifications:', error)
      setLoadingMore(false)
    }
  }, [userId, page, loadingMore, hasMore, supabase, filterType, searchTerm])

  // Load notifications when filters change
  useEffect(() => {
    if (!userId) return
    loadNotifications()
  }, [userId, loadNotifications])

  // Set up real-time subscription (separate from filter changes)
  useEffect(() => {
    if (!userId) return

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
          
          const newNotification = payload.new as any
          
          // Always add new notifications to the list (they're newest)
          // Filter logic is handled by the server when loading
          setNotifications(prev => [newNotification, ...prev])
          
          // Update unread count
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
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const deletedNotification = payload.old as any
          setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id))
          
          // Update unread count if deleted notification was unread
          if (!deletedNotification.read) {
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
  }, [userId, supabase])

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

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
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
    if (!userId) return false
    
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

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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
    loading,
    loadingMore,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadNotifications,
    loadMore
  }
}
