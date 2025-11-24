'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CurrentUserAvatar } from '@/components/current-user-avatar'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
      
      if (session?.user) {
        fetchNotifications(session.user.id)
        fetchUserTeam(session.user.id)
        checkAdminStatus(session.user)
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (session?.user) {
          fetchNotifications(session.user.id)
          fetchUserTeam(session.user.id)
          checkAdminStatus(session.user)
        } else {
          setNotifications([])
          setUnreadCount(0)
          setUserTeam(null)
          setIsCaptain(false)
          setIsAdmin(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const checkAdminStatus = (user: any) => {
    // Check if user has admin role in metadata
    const isUserAdmin = user?.app_metadata?.role === 'admin' || 
                        user?.raw_app_meta_data?.role === 'admin' ||
                        user?.email === 'tiznit.sos@gmail.com' // Temporary bypass
    setIsAdmin(isUserAdmin)
  }

  const fetchUserTeam = async (userId: string) => {
    try {
      // Get player's team
      const { data: playerData } = await supabase
        .from('players')
        .select('team_id')
        .eq('id', userId)
        .single()

      if (playerData?.team_id) {
        // Get team data
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('id', playerData.team_id)
          .single()

        if (teamData) {
          setUserTeam(teamData)
          setIsCaptain(teamData.captain_id === userId)
        }
      }
    } catch (error) {
      console.error('Error fetching user team:', error)
    }
  }

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching notifications:', error)
        return
      }

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) {
        console.error('Error marking notification as read:', error)
        return
      }

      // Refresh notifications
      if (user) {
        fetchNotifications(user.id)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl font-bold text-primary">⚔️ TeamFinder</div>
            </Link>
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="text-2xl font-bold text-primary">⚔️ TeamFinder</div>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link 
              href="/players" 
              className={cn(
                "text-foreground hover:text-primary transition",
                pathname === "/players" && "text-primary font-medium"
              )}
            >
              Players
            </Link>
            <Link 
              href="/teams" 
              className={cn(
                "text-foreground hover:text-primary transition",
                pathname === "/teams" && "text-primary font-medium"
              )}
            >
              Teams
            </Link>
            <Link 
              href="/tournaments" 
              className={cn(
                "text-foreground hover:text-primary transition",
                pathname === "/tournaments" && "text-primary font-medium"
              )}
            >
              Tournaments
            </Link>
            <Link 
              href="/search" 
              className={cn(
                "text-foreground hover:text-primary transition",
                pathname === "/search" && "text-primary font-medium"
              )}
            >
              Search
            </Link>
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <CurrentUserAvatar unreadCount={unreadCount} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      Account Settings
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/setup-profile">Profile</Link>
                </DropdownMenuItem>
                {userTeam && (
                  <DropdownMenuItem asChild>
                    {isCaptain ? (
                      <Link href="/manage-team">Manage Team</Link>
                    ) : (
                      <Link href="/view-team">View Team</Link>
                    )}
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="text-yellow-600 font-semibold">
                      Admin Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {notifications.slice(0, 3).map(notification => (
                  <DropdownMenuItem 
                    key={notification.id}
                    className="flex flex-col items-start p-3 cursor-pointer"
                    onClick={() => markNotificationAsRead(notification.id)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {notification.message}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                  </DropdownMenuItem>
                ))}
                {notifications.length > 3 && (
                  <DropdownMenuItem asChild>
                    <Link href="/notifications" className="text-center text-sm">
                      View all notifications
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/auth">Create an Account</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
