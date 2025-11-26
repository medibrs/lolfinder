'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, X, Users, Crown, AlertCircle, MessageSquare, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const initializeNotifications = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser(authUser)
        loadNotificationsForUser(authUser.id)
        
        // Set up real-time subscription - no polling, instant updates via WebSocket
        const channel = supabase
          .channel(`notifications-page-${authUser.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${authUser.id}`
            },
            async (payload) => {
              // Add new notification directly to state immediately
              const newNotification = payload.new as any
              setNotifications(prev => [newNotification, ...prev])
              
              // Enrich the notification in the background
              const enriched = await enrichNotification(newNotification)
              setNotifications(prev => prev.map(n => n.id === enriched.id ? enriched : n))
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${authUser.id}`
            },
            (payload) => {
              // Update notification in state directly
              const updatedNotification = payload.new as any
              setNotifications(prev => 
                prev.map(n => n.id === updatedNotification.id 
                  ? { ...n, ...updatedNotification } 
                  : n
                )
              )
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${authUser.id}`
            },
            (payload) => {
              // Remove notification from state directly
              const deletedId = payload.old.id
              setNotifications(prev => prev.filter(n => n.id !== deletedId))
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      } else {
        setLoading(false)
      }
    }
    
    initializeNotifications()
  }, [])

  // Helper function to enrich a single notification with player/team data
  const enrichNotification = async (notification: any) => {
    // For join requests - fetch player info if not already present
    if (notification.type === 'team_join_request' && notification.data?.player_id && !notification.data?.player) {
      const { data: playerData } = await supabase
        .from('players')
        .select('id, summoner_name, tier, main_role, secondary_role, opgg_link')
        .eq('id', notification.data.player_id)
        .single()
      
      if (playerData) {
        notification.data.player = playerData
      }
    }
    
    // For invitations - fetch inviter and team info if not already present
    if (notification.type === 'team_invitation') {
      const teamId = notification.data?.team_id
      
      // Fetch inviter info if missing
      if (!notification.data?.inviter && notification.data?.invitation_id) {
        const { data: invitationData } = await supabase
          .from('team_invitations')
          .select('invited_by')
          .eq('id', notification.data.invitation_id)
          .single()
        
        if (invitationData?.invited_by) {
          const { data: inviterData } = await supabase
            .from('players')
            .select('id, summoner_name, tier, main_role, secondary_role, opgg_link')
            .eq('id', invitationData.invited_by)
            .single()
          
          if (inviterData) {
            notification.data.inviter = inviterData
          }
        }
      }
      
      // Fetch team info if missing
      if (!notification.data?.team && teamId) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, name, team_size, open_positions')
          .eq('id', teamId)
          .single()
        
        const { data: teamMembers } = await supabase
          .from('players')
          .select('summoner_name, main_role, tier')
          .eq('team_id', teamId)
        
        if (teamData) {
          const memberCount = teamMembers?.length || 0
          const filledRoles = teamMembers?.map(m => m.main_role).filter(Boolean) || []
          
          const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']
          const memberRanks = teamMembers?.map(m => {
            const tierBase = m.tier?.split(' ')[0]
            return rankOrder.indexOf(tierBase)
          }).filter(r => r >= 0) || []
          
          const avgRankIndex = memberRanks.length > 0 
            ? Math.round(memberRanks.reduce((a, b) => a + b, 0) / memberRanks.length)
            : -1
          const averageRank = avgRankIndex >= 0 ? rankOrder[avgRankIndex] : 'Unknown'
          
          notification.data.team = {
            member_count: memberCount,
            max_size: teamData.team_size || 6,
            average_rank: averageRank,
            open_positions: teamData.open_positions || [],
            filled_roles: filledRoles,
            members: teamMembers || []
          }
        }
      }
    }
    
    return notification
  }

  const loadNotificationsForUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      // Enrich notifications with player data for join requests and invitations
      const enrichedNotifications = await Promise.all(
        (data || []).map(notification => enrichNotification(notification))
      )

      setNotifications(prev => {
        // Merge fetched notifications with any real-time updates that came in while fetching
        const fetchedIds = new Set(enrichedNotifications.map(n => n.id))
        const newItems = prev.filter(n => !fetchedIds.has(n.id))
        
        const combined = [...newItems, ...enrichedNotifications].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return combined
      })

      // Mark all unread notifications as read when visiting the page
      const unreadNotifications = data?.filter(n => !n.read) || []
      if (unreadNotifications.length > 0) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false)
        
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
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
        return
      }

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        return
      }

      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      )
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
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
        return
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getNotificationIcon = (notification: any) => {
    const type = notification.type
    const data = notification.data

    switch (type) {
      case 'team_invitation':
        return <Users className="w-5 h-5 text-blue-500" />
      case 'team_join_request':
        return <Users className="w-5 h-5 text-green-500" />
      case 'team_join_accepted':
        return <Check className="w-5 h-5 text-green-500" />
      case 'team_join_rejected':
        return <X className="w-5 h-5 text-red-500" />
      case 'team_member_joined':
        return <Crown className="w-5 h-5 text-yellow-500" />
      case 'team_member_left':
        return <Users className="w-5 h-5 text-gray-500" />
      case 'team_member_removed':
        return <X className="w-5 h-5 text-red-500" />
      case 'team_invitation_cancelled':
        return <X className="w-5 h-5 text-orange-500" />
      case 'system':
        return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'admin_message':
        return <MessageSquare className="w-5 h-5 text-purple-500" />
      case 'tournament_approved':
        return <Trophy className={`w-5 h-5 ${data?.from === 'admin' ? 'text-purple-500' : 'text-green-500'}`} />
      case 'tournament_rejected':
        return <Trophy className={`w-5 h-5 ${data?.from === 'admin' ? 'text-purple-500' : 'text-red-500'}`} />
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  const handleInvitationAction = async (notification: any, action: 'accept' | 'reject') => {
    if (processingAction) return

    try {
      setProcessingAction(notification.id)
      setErrorMessage(null)
      const invitationData = notification.data
      
      if (!invitationData?.invitation_id) {
        setErrorMessage('Invalid invitation data')
        return
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`/api/team-invitations/${invitationData.invitation_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: action }),
      })

      const responseData = await response.json()

      if (response.ok) {
        // Remove notification from UI immediately
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
        
        // Reload page to update team status
        setTimeout(() => window.location.reload(), 500)
      } else {
        // Show error message to user
        setErrorMessage(responseData.error || 'Failed to process invitation')
        
        // Auto-clear error after 5 seconds
        setTimeout(() => setErrorMessage(null), 5000)
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error)
      setErrorMessage('An unexpected error occurred')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setProcessingAction(null)
    }
  }

  const handleJoinRequestAction = async (notification: any, action: 'accept' | 'reject') => {
    if (processingAction) return

    try {
      setProcessingAction(notification.id)
      setErrorMessage(null)
      const requestData = notification.data
      
      if (!requestData?.request_id) {
        setErrorMessage('Invalid request data')
        return
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`/api/team-join-requests/${requestData.request_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action: action }),
      })

      const responseData = await response.json()

      if (response.ok) {
        // Remove notification from UI immediately
        setNotifications(prev => prev.filter(n => n.id !== notification.id))
        
        // Reload page to update team status
        setTimeout(() => window.location.reload(), 500)
      } else {
        // Show error message to user
        setErrorMessage(responseData.error || 'Failed to process request')
        
        // Auto-clear error after 5 seconds
        setTimeout(() => setErrorMessage(null), 5000)
      }
    } catch (error) {
      console.error(`Error ${action}ing join request:`, error)
      setErrorMessage('An unexpected error occurred')
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setProcessingAction(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-4">Loading Notifications</h2>
          </div>
        </div>
      </main>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Bell className="w-8 h-8" />
              Notifications
            </h1>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline">
                  <Check className="w-4 h-4 mr-2" />
                  Mark All Read
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-500 font-medium">{errorMessage}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-auto"
              onClick={() => setErrorMessage(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <Card 
                key={notification.id} 
                className={`bg-card border-border ${
                  !notification.read ? 'border-primary/50' : ''
                } ${
                  notification.type === 'admin_message' || ((notification.type === 'tournament_approved' || notification.type === 'tournament_rejected') && notification.data?.from === 'admin') 
                    ? 'border-purple-500/50 bg-purple-500/5' 
                    : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{notification.title}</h3>
                          {!notification.read && (
                            <Badge variant="default" className="text-xs">New</Badge>
                          )}
                          {(notification.type === 'admin_message' || ((notification.type === 'tournament_approved' || notification.type === 'tournament_rejected') && notification.data?.from === 'admin')) && (
                            <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mb-3">{notification.message}</p>
                        
                        {/* Display detailed team info for invitations */}
                        {notification.type === 'team_invitation' && notification.data?.team && (
                          <div className="bg-muted/50 rounded-lg p-3 mb-3 space-y-3">
                            {/* Team Stats */}
                            <div className="flex flex-wrap gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Team Size:</span>{' '}
                                <span className="font-medium">{notification.data.team.member_count}/{notification.data.team.max_size}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Avg Rank:</span>{' '}
                                <span className="font-medium">{notification.data.team.average_rank}</span>
                              </div>
                              {notification.data.team.open_positions?.length > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Looking for:</span>{' '}
                                  <span className="font-medium text-green-500">
                                    {notification.data.team.open_positions.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Current Team Members */}
                            {notification.data.team.members?.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Current Roster:</p>
                                <div className="flex flex-wrap gap-2">
                                  {notification.data.team.members.map((member: any, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {member.summoner_name} • {member.tier?.split(' ')[0]} {member.main_role}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Inviter Info */}
                            {notification.data.inviter && (
                              <div className="pt-2 border-t border-border">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Invited by:</p>
                                    <p className="font-medium">{notification.data.inviter.summoner_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {notification.data.inviter.tier} • {notification.data.inviter.main_role}
                                      {notification.data.inviter.secondary_role && ` / ${notification.data.inviter.secondary_role}`}
                                    </p>
                                  </div>
                                  {notification.data.inviter.opgg_link && (
                                    <Button variant="outline" size="sm" asChild>
                                      <a
                                        href={notification.data.inviter.opgg_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        View OP.GG
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Display detailed user info for join requests */}
                        {notification.type === 'team_join_request' && notification.data?.player && (
                          <div className="bg-muted/50 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium">{notification.data.player.summoner_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {notification.data.player.tier} • {notification.data.player.main_role}
                                    {notification.data.player.secondary_role && ` / ${notification.data.player.secondary_role}`}
                                  </p>
                                </div>
                              </div>
                              {notification.data.player.opgg_link && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={notification.data.player.opgg_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View OP.GG
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Team Invitation Actions - only show for pending invitations */}
                        {notification.type === 'team_invitation' && notification.data?.invitation_id && (
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleInvitationAction(notification, 'accept')}
                              disabled={processingAction === notification.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processingAction === notification.id ? (
                                'Processing...'
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  Accept
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleInvitationAction(notification, 'reject')}
                              disabled={processingAction === notification.id}
                              size="sm"
                              variant="outline"
                            >
                              {processingAction === notification.id ? (
                                'Processing...'
                              ) : (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        
                        {/* Team Join Request Actions */}
                        {notification.type === 'team_join_request' && notification.data?.request_id && (
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={() => handleJoinRequestAction(notification, 'accept')}
                              disabled={processingAction === notification.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processingAction === notification.id ? (
                                'Processing...'
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  Accept
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleJoinRequestAction(notification, 'reject')}
                              disabled={processingAction === notification.id}
                              size="sm"
                              variant="outline"
                            >
                              {processingAction === notification.id ? (
                                'Processing...'
                              ) : (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground mt-3">
                          {new Date(notification.created_at).toLocaleDateString()} at{' '}
                          {new Date(notification.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {!notification.read && (
                        <Button
                          onClick={() => markAsRead(notification.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => deleteNotification(notification.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-card border-border p-12">
              <div className="text-center">
                <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-bold mb-4">No Notifications</h2>
                <p className="text-muted-foreground mb-8">
                  You don't have any notifications yet. They'll appear here when you get team invitations or updates.
                </p>
                <Button asChild>
                  <Link href="/players">Find Players</Link>
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
