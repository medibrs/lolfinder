'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
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
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Navigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeAdminTab = searchParams.get('tab') || 'overview'
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = createClient()

  // Global notifications hook
  const { notifications, unreadCount } = useRealtimeNotifications(user?.id || null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      
      if (authUser) {
        fetchUserTeam(authUser.id)
        
        // Check if user is admin
        const isUserAdmin = authUser.app_metadata?.role === 'admin'
        setIsAdmin(isUserAdmin)
      }
      
      setLoading(false)
    }
    
    fetchUser()
  }, [])

  
  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (session?.user) {
          fetchUserTeam(session.user.id)
          checkAdminStatus(session.user)
        } else {
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

  
  const handleSignOut = async () => {
    try {
      await fetch('/auth/signout', { method: 'POST' })
      window.location.href = '/auth'
    } catch (error) {
      console.error('Error signing out:', error)
      // Fallback to client-side signout if server fails
      await supabase.auth.signOut()
      window.location.href = '/auth'
    }
  }

  if (loading) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/logo.png" 
                alt="TeamFinder" 
                width={180} 
                height={48} 
                className="h-12 w-auto object-contain"
                priority
              />
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
            <Image 
              src="/logo.png" 
              alt="TeamFinder" 
              width={180} 
              height={48} 
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
          
          {/* Mobile Menu */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <Button variant="ghost" className="relative h-10 w-10 rounded-full" asChild>
                <Link href="/notifications">
                  <CurrentUserAvatar unreadCount={unreadCount} />
                </Link>
              </Button>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <nav className="flex flex-col gap-2 mt-6">
                  {user ? (
                    // Authenticated user links
                    <>
                      <Link 
                        href="/players" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-base font-medium px-3 py-2 rounded-md transition",
                          pathname === "/players" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        Players
                      </Link>
                      <Link 
                        href="/teams" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-base font-medium px-3 py-2 rounded-md transition",
                          pathname === "/teams" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        Teams
                      </Link>
                      <Link 
                        href="/tournaments" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-base font-medium px-3 py-2 rounded-md transition",
                          pathname === "/tournaments" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        Tournaments
                      </Link>
                      <Link 
                        href="/search" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-base font-medium px-3 py-2 rounded-md transition",
                          pathname === "/search" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        Join/Invite
                      </Link>
                    </>
                  ) : (
                    // Public links
                    <>
                      <Link 
                        href="/tournaments" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "text-base font-medium px-3 py-2 rounded-md transition",
                          pathname === "/tournaments" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                        )}
                      >
                        Tournaments
                      </Link>
                      <Link 
                        href="/#about" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                      >
                        About
                      </Link>
                      <Link 
                        href="/#how-it-works" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                      >
                        How It Works
                      </Link>
                      <Link 
                        href="/#features" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                      >
                        Features
                      </Link>
                    </>
                  )}
                  
                  {user && (
                    <>
                      <div className="border-t my-1"></div>
                      <Link 
                        href="/setup-profile" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                      >
                        Profile
                      </Link>
                      <Link 
                        href="/settings" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                      >
                        Settings
                      </Link>
                      {userTeam && (
                        <Link 
                          href={isCaptain ? "/manage-team" : "/view-team"}
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition"
                        >
                          {isCaptain ? "Manage Team" : "View Team"}
                        </Link>
                      )}
                      {isAdmin && (
                        <Link 
                          href="/admin" 
                          onClick={() => setMobileMenuOpen(false)}
                          className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition text-yellow-600"
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      <Link 
                        href="/notifications" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition flex items-center justify-between"
                      >
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                      <div className="border-t my-1"></div>
                      <Button 
                        onClick={() => {
                          handleSignOut()
                          setMobileMenuOpen(false)
                        }}
                        variant="destructive"
                        size="sm"
                        className="w-full"
                      >
                        Sign Out
                      </Button>
                    </>
                  )}
                  
                  {!user && (
                    <>
                      <div className="border-t my-1"></div>
                      {pathname !== '/auth' && (
                        <Button asChild size="sm" className="w-full">
                          <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                            Sign In
                          </Link>
                        </Button>
                      )}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {pathname === '/admin' ? (
              // Admin tabs when on admin page
              <>
                <Link 
                  href="/admin?tab=overview" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'overview' && "text-primary font-medium"
                  )}
                >
                  Overview
                </Link>
                <Link 
                  href="/admin?tab=players" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'players' && "text-primary font-medium"
                  )}
                >
                  Players
                </Link>
                <Link 
                  href="/admin?tab=teams" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'teams' && "text-primary font-medium"
                  )}
                >
                  Teams
                </Link>
                <Link 
                  href="/admin?tab=tournaments" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'tournaments' && "text-primary font-medium"
                  )}
                >
                  Tournaments
                </Link>
                <Link 
                  href="/admin?tab=registrations" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'registrations' && "text-primary font-medium"
                  )}
                >
                  Registrations
                </Link>
                <Link 
                  href="/admin?tab=users" 
                  className={cn(
                    "text-foreground hover:text-primary transition text-sm",
                    activeAdminTab === 'users' && "text-primary font-medium"
                  )}
                >
                  User Roles
                </Link>
              </>
            ) : user ? (
              // Authenticated user navigation
              <>
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
                  Join/Invite
                </Link>
              </>
            ) : (
              // Public navigation (unauthenticated)
              <>
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
                  href="/#about" 
                  className="text-foreground hover:text-primary transition"
                >
                  About
                </Link>
                <Link 
                  href="/#how-it-works" 
                  className="text-foreground hover:text-primary transition"
                >
                  How It Works
                </Link>
                <Link 
                  href="/#features" 
                  className="text-foreground hover:text-primary transition"
                >
                  Features
                </Link>
              </>
            )}
          </div>

          {/* Desktop Avatar/Auth */}
          <div className="hidden md:flex items-center gap-2">
            {isAdmin && pathname !== '/admin' && (
              <Button asChild variant="outline" className="text-yellow-600 border-yellow-600 hover:bg-yellow-50 hover:text-yellow-700">
                <Link href="/admin">Admin</Link>
              </Button>
            )}
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
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
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
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            pathname !== '/auth' && (
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/auth">Sign In</Link>
              </Button>
            )
          )}
          </div>
        </div>
      </div>
    </nav>
  )
}
