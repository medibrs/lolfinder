'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, X, Users, Crown, AlertCircle, MessageSquare, RefreshCw, Trophy, Search, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notificationManager } from '@/lib/browser-notifications'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300) // 300ms debounce
  const supabase = createClient()
  
  // Use the shared notifications hook with pagination and filters
  const { 
    notifications, 
    unreadCount, 
    loading: notificationsLoading,
    loadingMore,
    hasMore,
    markAsRead: markNotificationAsRead, 
    markAllAsRead: markAllNotificationsAsRead,
    deleteNotification: deleteNotificationFromHook,
    loadNotifications: refreshNotifications,
    loadMore
  } = useRealtimeNotifications(user?.id || null, filterType, debouncedSearchTerm)

  useEffect(() => {
    const initializePage = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      setLoading(false)
    }
    
    initializePage()
  }, [])

  // Mark all as read when visiting the page (but only if there are unread notifications)
  useEffect(() => {
    if (user && unreadCount > 0) {
      markAllNotificationsAsRead()
    }
  }, [user, unreadCount, markAllNotificationsAsRead])

  // Helper function to enrich a single notification with player/team data
  const enrichNotification = async (notification: any) => {
    // For join requests - always fetch fresh player data to check if they're already on a team
    if (notification.type === 'team_join_request') {
      // Get player ID from either player_id or player.id
      const playerId = notification.data?.player_id || notification.data?.player?.id
      
      if (playerId) {
        const { data: playerData } = await supabase
          .from('players')
          .select('id, summoner_name, tier, main_role, secondary_role, opgg_link, team_id, team_name')
          .eq('id', playerId)
          .single()
        
        if (playerData) {
          // Check if player is already on a team
          if (playerData.team_id) {
            notification.data.player = {
              ...playerData,
              alreadyOnTeam: true,
              currentTeamName: playerData.team_name || 'Unknown Team'
            }
          } else {
            notification.data.player = {
              ...playerData,
              alreadyOnTeam: false
            }
          }
        }
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

  const markAsRead = async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId)
    if (!success) {
      console.error('Error marking notification as read')
    }
  }

  const deleteNotification = async (notificationId: string) => {
    await deleteNotificationFromHook(notificationId)
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
        // Remove notification from UI immediately using hook
        await deleteNotificationFromHook(notification.id)
        
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
        // Remove notification from UI immediately using hook
        await deleteNotificationFromHook(notification.id)
        
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

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
              <Bell className="w-6 h-6 sm:w-8 sm:h-8" />
              Notifications
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button 
                onClick={() => refreshNotifications()} 
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="team_invitation">Team Invitations</SelectItem>
                  <SelectItem value="team_join_request">Join Requests</SelectItem>
                  <SelectItem value="team_join_accepted">Join Accepted</SelectItem>
                  <SelectItem value="team_join_rejected">Join Rejected</SelectItem>
                  <SelectItem value="team_member_joined">Member Joined</SelectItem>
                  <SelectItem value="team_member_left">Member Left</SelectItem>
                  <SelectItem value="team_member_removed">Member Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Filter summary */}
          {(filterType !== 'all' || searchTerm) && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <span>Showing:</span>
              {filterType !== 'all' && (
                <Badge variant="secondary" className="capitalize">
                  {filterType.replace(/_/g, ' ')}
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="secondary">
                  "{searchTerm}"
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterType('all')
                  setSearchTerm('')
                }}
                className="h-6 px-2 text-xs"
              >
                Clear filters
              </Button>
            </div>
          )}
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
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="mt-1 flex-shrink-0">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                            {/* Warning if player is already on a team */}
                            {notification.data.player.alreadyOnTeam && (
                              <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/50 rounded-lg">
                                <div className="flex items-center gap-2 text-orange-500">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="font-medium text-sm">
                                    This player is already on a team: {notification.data.player.currentTeamName}
                                  </span>
                                </div>
                              </div>
                            )}
                            
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
                              disabled={processingAction === notification.id || notification.data.player?.alreadyOnTeam}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            >
                              {processingAction === notification.id ? (
                                'Processing...'
                              ) : notification.data.player?.alreadyOnTeam ? (
                                'Already on Team'
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
                    
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
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
                <h2 className="text-2xl font-bold mb-4">
                  {filterType !== 'all' || searchTerm ? 'No Matching Notifications' : 'No Notifications'}
                </h2>
                <p className="text-muted-foreground">
                  {filterType !== 'all' || searchTerm 
                    ? 'No notifications match your current filters. Try adjusting your search or filter criteria.'
                    : "You don't have any notifications yet. They'll appear here when you get team invitations or updates."
                  }
                </p>
                {(filterType !== 'all' || searchTerm) && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setFilterType('all')
                      setSearchTerm('')
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </Card>
          )}
          
          {/* Load More Button */}
          {notifications.length > 0 && hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                className="w-full max-w-xs"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Notifications'
                )}
              </Button>
            </div>
          )}
          
          {/* End of notifications indicator */}
          {notifications.length > 0 && !hasMore && (
            <p className="text-center text-muted-foreground text-sm mt-6">
              You've reached the end of your notifications
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
