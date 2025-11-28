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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Menu, HelpCircle, MessageSquare, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import FeatureRequestDialog from '@/components/FeatureRequestDialog'

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
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false)
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
      const response = await fetch('/auth/signout', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        // Clear any local state and redirect
        window.location.href = '/auth'
      } else {
        console.error('Signout failed:', data.error)
        // Still redirect even if server signout fails
        await supabase.auth.signOut()
        window.location.href = '/auth'
      }
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
                style={{ width: 'auto', height: '48px' }}
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
              style={{ width: 'auto', height: '48px' }}
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
                      <p className="text-xs text-muted-foreground px-3 py-1">Help & Support</p>
                      <a 
                        href="mailto:support@teamfinder.gg"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Contact Support
                      </a>
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          setMobileMenuOpen(false)
                          setTimeout(() => setFeatureDialogOpen(true), 100)
                        }}
                        className="text-base font-medium px-3 py-2 h-auto rounded-md hover:bg-accent transition flex items-center gap-2 w-full justify-start"
                      >
                        <Lightbulb className="h-4 w-4" />
                        Request Feature
                      </Button>
                      <a 
                        href="#"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-base font-medium px-3 py-2 rounded-md hover:bg-accent transition flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.5152.0699.0699 0 00-.0321.0277C.5334 9.0463-.319 13.5809.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.975 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                        </svg>
                        Discord Community
                      </a>
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
            
            {/* Help/Support Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="relative">
                  {/* Discord Background Image */}
                  <div className="relative h-48 bg-cover bg-center rounded-t-lg" 
                       style={{ backgroundImage: 'url(/discord-bg-small.webp)' }}>
                    <div className="absolute inset-0 bg-black/40 rounded-t-lg">
                      <div className="flex flex-col items-center justify-center h-full text-white p-4">
                        <h4 className="font-bold text-lg mb-2">Need help?</h4>
                        <p className="text-sm text-center opacity-90">
                          Get support or share your ideas with us
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Links Section */}
                  <div className="bg-background p-4 space-y-3 rounded-b-lg">
                    <a 
                      href="mailto:support@teamfinder.gg" 
                      className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors border border-border"
                    >
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium">Contact Support</span>
                        <p className="text-xs text-muted-foreground">Get help with your account</p>
                      </div>
                    </a>
                    
                    <FeatureRequestDialog>
                      <Button 
                        variant="ghost" 
                        className="flex items-center gap-3 p-3 h-auto justify-start w-full rounded-md hover:bg-accent transition-colors border border-border"
                      >
                        <Lightbulb className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <span className="text-sm font-medium">Request a Feature</span>
                          <p className="text-xs text-muted-foreground">Share your ideas with us</p>
                        </div>
                      </Button>
                    </FeatureRequestDialog>
                    
                    <a 
                      href="#" 
                      className="flex items-center justify-center gap-2 w-full bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-md py-3 px-4 text-sm font-medium transition-colors"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.5152.0699.0699 0 00-.0321.0277C.5334 9.0463-.319 13.5809.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189zm7.975 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                      </svg>
                      <span className="font-medium">Join us on Discord</span>
                    </a>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

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
      
      {/* Standalone Feature Request Dialog */}
      <FeatureRequestDialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <div />
      </FeatureRequestDialog>
    </nav>
  )
}
