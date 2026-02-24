"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users, Target, Zap, Shield, Crown, Bell, Settings, User, Medal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Footer from '@/components/footer'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [isCaptain, setIsCaptain] = useState(false)
  const [playerProfile, setPlayerProfile] = useState<any>(null)
  const [profileChecked, setProfileChecked] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      try {
        // First check if we have an existing session
        const { data: { session } } = await supabase.auth.getSession()

        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            setSessionChecked(true)

            // Fetch user's player profile (includes Riot Games name)
            const { data: profileData } = await supabase
              .from('players')
              .select('*')
              .eq('id', session.user.id)
              .single()

            if (profileData) {
              setPlayerProfile(profileData)
            }

            // Profile check is complete
            setProfileChecked(true)

            // Fetch user's team
            const { data: playerData } = await supabase
              .from('players')
              .select('teams(*)')
              .eq('id', session.user.id)
              .single()

            if (playerData?.teams && Array.isArray(playerData.teams) && playerData.teams.length > 0) {
              const team = playerData.teams[0]
              setUserTeam(team)
              setIsCaptain(team.captain_id === session.user.id)
            }
          } else {
            setUser(null)
            setSessionChecked(true)
            setProfileChecked(true)
          }
        }
      } catch (error) {

        if (mounted) {
          setUser(null)
          setSessionChecked(true)
          setProfileChecked(true)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setSessionChecked(true)
        setLoading(false)
      }
    })

    getUser()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading || !sessionChecked) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If user is not authenticated, show landing page
  if (!user) {
    return (
      <main className="pt-16">
        {/* Hero Section */}
        <section className="min-h-screen bg-gradient-to-b from-background via-background to-card flex items-center justify-center px-4 py-20">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-semibold mb-6">
                🎮 The Premier LoL Tournament Platform
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-black mb-6 text-balance">
              League of Legends <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Team Finder</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 text-balance max-w-3xl mx-auto">
              Find your LoL team, recruit competitive players and join tournaments for Clash, Flex and ranked. The #1 platform to find teammates.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                <Link href="/auth">Get Started Free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6">
                <Link href="/tournaments">View Tournaments</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-20 px-4 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">About Our Platform</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                We're building the most comprehensive League of Legends tournament and team-finding platform
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-card border-border p-8 hover:border-primary/50 transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Team Building</h3>
                <p className="text-muted-foreground">
                  Connect with players of your skill level. Create or join teams with advanced filtering by rank, role, and playstyle.
                </p>
              </Card>

              <Card className="bg-card border-border p-8 hover:border-primary/50 transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Competitive Play</h3>
                <p className="text-muted-foreground">
                  Participate in organized tournaments with real prizes. Track your team's performance and climb the leaderboards.
                </p>
              </Card>

              <Card className="bg-card border-border p-8 hover:border-primary/50 transition-all">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Fair & Organized</h3>
                <p className="text-muted-foreground">
                  Admin-managed tournaments ensure fair play. Automated notifications keep everyone informed and engaged.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Get started in minutes and find your perfect team
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  1
                </div>
                <h3 className="text-xl font-bold mb-2">Create Profile</h3>
                <p className="text-muted-foreground">
                  Sign up and set up your player profile with your rank, roles, and preferences
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  2
                </div>
                <h3 className="text-xl font-bold mb-2">Find or Create Team</h3>
                <p className="text-muted-foreground">
                  Browse teams looking for players or create your own and recruit members
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  3
                </div>
                <h3 className="text-xl font-bold mb-2">Register for Tournaments</h3>
                <p className="text-muted-foreground">
                  Join upcoming tournaments and compete against other teams
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  4
                </div>
                <h3 className="text-xl font-bold mb-2">Compete & Win</h3>
                <p className="text-muted-foreground">
                  Play matches, track progress, and win prizes with your team
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 bg-card/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Platform Features</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Everything you need to build, manage, and compete with your team
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border p-6">
                <Target className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Smart Matchmaking</h3>
                <p className="text-muted-foreground text-sm">
                  Find players and teams based on rank, role, region, and availability
                </p>
              </Card>

              <Card className="bg-card border-border p-6">
                <Users className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Team Management</h3>
                <p className="text-muted-foreground text-sm">
                  Manage rosters, set open positions, and handle join requests easily
                </p>
              </Card>

              <Card className="bg-card border-border p-6">
                <Trophy className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Tournament System</h3>
                <p className="text-muted-foreground text-sm">
                  Organized tournaments with brackets, schedules, and prize tracking
                </p>
              </Card>

              <Card className="bg-card border-border p-6">
                <Zap className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Real-time Notifications</h3>
                <p className="text-muted-foreground text-sm">
                  Instant updates for invites, requests, and tournament announcements
                </p>
              </Card>

              <Card className="bg-card border-border p-6">
                <Shield className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Admin Oversight</h3>
                <p className="text-muted-foreground text-sm">
                  Dedicated admins ensure fair play and handle disputes
                </p>
              </Card>

              <Card className="bg-card border-border p-6">
                <Crown className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold mb-2">Leaderboards</h3>
                <p className="text-muted-foreground text-sm">
                  Track your team's ranking and compete for top positions
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* SEO Content Section */}
        <section className="py-16 px-4 bg-background">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Why Use Our League of Legends Team Finder?</h2>
            <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground">
              <p className="mb-4">
                Looking to <strong>find LoL team</strong> without endless Discord scrolling? Our <strong>League of Legends team finder</strong> connects you with players who match your rank, role and schedule—so you spend less time searching and more time winning.
              </p>
              <p className="mb-4">
                Create or join a <strong>LoL tournament team</strong>, filter by rank and role, and get ready for Clash, Flex or community tournaments in just a few clicks. Whether you're a jungler, mid, ADC, top or support, you can <strong>find teammates for ranked, Clash, Flex</strong> who are serious about improvement.
              </p>
              <p className="mb-4">
                We focus on <strong>competitive LoL players</strong> who want structured games, scrims and tournaments instead of random solo queue chaos. Use advanced filters to discover teams that fit your playstyle, language and time zone, or list your own team and start recruiting instantly.
              </p>
              <p>
                From casual Clash stacks to long-term competitive rosters, our tools make it simple to build a stable LoL team, track your progress and stay connected with your teammates.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-background to-card">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Find Your LoL Team?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of players using our League of Legends team finder to build teams and compete in tournaments
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                <Link href="/auth">Create Free Account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6">
                <Link href="/tournaments">Browse Tournaments</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // If user is authenticated, show personalized dashboard
  return (
    <>
      <main className="pt-16 min-h-screen bg-black text-gray-100">
        {/* Hero Welcome Section */}
        {/* Hero Welcome Section */}
        <section className="relative bg-black px-4 py-24 text-white overflow-hidden min-h-[450px] flex items-center">
          {/* Background Banner Image with improved Vignette */}
          <div className="absolute inset-0">
            <img
              src="/home-page-banner.jpg"
              alt="League of Legends Banner"
              className="w-full h-full object-cover opacity-40 scale-105"
            />
            {/* Ambient Particles Overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-magic-float shadow-[0_0_15px_rgba(234,179,8,1)]" style={{ animationDelay: '0s' }}></div>
              <div className="absolute top-1/2 left-1/3 w-2 h-2 bg-blue-400 rounded-full animate-magic-float shadow-[0_0_20px_rgba(37,99,235,1)]" style={{ animationDelay: '2s' }}></div>
              <div className="absolute top-3/4 left-2/3 w-1.5 h-1.5 bg-purple-400 rounded-full animate-magic-float shadow-[0_0_15px_rgba(147,51,234,1)]" style={{ animationDelay: '4s' }}></div>
              <div className="absolute top-1/3 left-3/4 w-2 h-2 bg-yellow-200 rounded-full animate-magic-float shadow-[0_0_18px_rgba(254,240,138,1)]" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-cyan-400 rounded-full animate-magic-float shadow-[0_0_12px_rgba(34,211,238,1)]" style={{ animationDelay: '3s' }}></div>
              <div className="absolute top-1/5 left-4/5 w-1.5 h-1.5 bg-red-400 rounded-full animate-magic-float shadow-[0_0_15px_rgba(239,68,68,1)]" style={{ animationDelay: '5s' }}></div>
            </div>
            {/* The Gradient/Vignette layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950/40 via-black/60 to-black"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_black_85%)]"></div>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto text-center">
            <h1 className="text-4xl md:text-7xl font-bold mb-6 font-beaufort tracking-tight">
              <span className="text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] font-beaufort">
                Welcome Back, {playerProfile?.riot_games_name || 'Summoner'}!
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-16 uppercase tracking-[0.5em] font-beaufort drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              Get ready to dominate the Rift
            </p>

            {/* Hextech Glassmorphic Navigation Panels */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-center items-center max-w-lg md:max-w-5xl mx-auto">
              {/* Browse Teams */}
              <Link
                href="/teams"
                className="group relative flex flex-col items-center justify-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl py-8 px-6 hover:border-cyan-500/50 hover:bg-slate-900/60 transition-all duration-300 hover:-translate-y-2 shadow-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <div className="p-3 bg-slate-800/50 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                  <Users className="w-8 h-8 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Browse Teams</span>
                <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 w-0 group-hover:w-full transition-all duration-500"></div>
              </Link>

              {/* Tournaments */}
              <Link
                href="/tournaments"
                className="group relative flex flex-col items-center justify-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl py-8 px-6 hover:border-yellow-500/50 hover:bg-slate-900/60 transition-all duration-300 hover:-translate-y-2 shadow-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <div className="p-3 bg-slate-800/50 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                  <Trophy className="w-8 h-8 text-slate-400 group-hover:text-yellow-500 transition-colors" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Tournaments</span>
                <div className="absolute bottom-0 left-0 h-1 bg-yellow-500 w-0 group-hover:w-full transition-all duration-500"></div>
              </Link>

              {/* Find Players */}
              <Link
                href="/players"
                className="group relative flex flex-col items-center justify-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl py-8 px-6 hover:border-blue-500/50 hover:bg-slate-900/60 transition-all duration-300 hover:-translate-y-2 shadow-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <div className="p-3 bg-slate-800/50 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                  <User className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Find Players</span>
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-0 group-hover:w-full transition-all duration-500"></div>
              </Link>

              {/* Leaderboard */}
              <Link
                href="/leaderboard"
                className="group relative flex flex-col items-center justify-center gap-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl py-8 px-6 hover:border-purple-500/50 hover:bg-slate-900/60 transition-all duration-300 hover:-translate-y-2 shadow-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
              >
                <div className="p-3 bg-slate-800/50 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                  <Medal className="w-8 h-8 text-slate-400 group-hover:text-purple-400 transition-colors" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">Leaderboard</span>
                <div className="absolute bottom-0 left-0 h-1 bg-purple-500 w-0 group-hover:w-full transition-all duration-500"></div>
              </Link>
            </div>
          </div>
        </section>

        {/* Profile Setup Banner */}
        {user && !playerProfile && profileChecked && (
          <section className="px-4 py-6 bg-black">
            <div className="max-w-6xl mx-auto">
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-200">Complete Your Player Profile</h3>
                      <p className="text-sm text-gray-500">Create your profile to join teams and participate in tournaments</p>
                    </div>
                  </div>
                  <Button asChild className="bg-gray-800 hover:bg-gray-700 text-gray-100">
                    <Link href="/setup-profile">Set Up Profile</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Create/Join Team Cards */}
        <section className="px-4 py-16 bg-black">
          <div className="max-w-6xl mx-auto">
            {!userTeam && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                {/* Create Team Card */}
                <Link href="/create-team" className="group relative overflow-hidden rounded-2xl border border-slate-800 border-t-4 border-t-purple-500 bg-black p-8 hover:border-purple-500/50 transition-all duration-300">
                  <div className="relative z-10 flex flex-col items-center text-center py-4">
                    {/* The Icon Container - Borderless & Maximized with Backlight */}
                    <div className="mb-2 flex h-48 w-48 items-center justify-center group-hover:rotate-6 transition-all duration-700 transform relative">
                      {/* Ambient Backlight */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple-600/30 blur-[60px] rounded-full group-hover:bg-purple-500/50 transition-all duration-500" />
                      <img src="/gemstone.webp" alt="Gemstone" className="relative z-10 h-40 w-40 object-contain group-hover:scale-110 transition-all duration-500" />
                    </div>

                    <h3 className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors tracking-tight">
                      Create a Team
                    </h3>
                    <p className="mt-4 text-slate-400 text-lg max-w-sm leading-relaxed">
                      Start your own team and recruit players to dominate the Rift. Lead your squad to victory.
                    </p>

                    <div className="mt-8 px-8 py-3 rounded-lg bg-purple-600/10 border border-purple-600/30 text-purple-500 font-bold group-hover:bg-purple-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all duration-300 tracking-wide">
                      Start Your Team
                    </div>
                  </div>
                </Link>

                {/* Join Team Card */}
                <Link href="/teams" className="group relative overflow-hidden rounded-2xl border border-slate-800 border-t-4 border-t-yellow-500 bg-black p-8 hover:border-yellow-500/50 transition-all duration-300">
                  <div className="relative z-10 flex flex-col items-center text-center py-4">
                    {/* The Icon Container - Borderless & Maximized with Backlight */}
                    <div className="mb-2 flex h-48 w-48 items-center justify-center group-hover:-rotate-6 transition-all duration-700 transform relative">
                      {/* Ambient Backlight */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-yellow-600/20 blur-[60px] rounded-full group-hover:bg-yellow-500/40 transition-all duration-500" />
                      <img src="/key-fragment.png" alt="Key Fragment" className="relative z-10 h-40 w-40 object-contain group-hover:scale-110 transition-all duration-500" />
                    </div>

                    <h3 className="text-3xl font-bold text-white group-hover:text-yellow-400 transition-colors tracking-tight">
                      Join a Team
                    </h3>
                    <p className="mt-4 text-slate-400 text-lg max-w-sm leading-relaxed">
                      Find existing teams looking for players like you. Become the missing key to their success.
                    </p>

                    <div className="mt-8 px-8 py-3 rounded-lg bg-transparent border border-slate-500 text-slate-300 font-bold group-hover:bg-yellow-600 group-hover:text-white group-hover:border-yellow-600 group-hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all duration-300 tracking-wide">
                      Join Now
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Team Status for users with teams */}
            {userTeam && (
              <div className="mb-16">
                <h2 className="text-3xl font-bold text-center mb-8 text-gray-100">Your Team Status</h2>
                <Card className="bg-gray-900 shadow-xl border border-gray-800">
                  <CardHeader className="bg-gray-900 border-b border-gray-800">
                    <CardTitle className="flex items-center gap-2 text-xl text-gray-100">
                      <Crown className="w-6 h-6 text-gray-400" />
                      {userTeam.name}
                      {isCaptain && <span className="text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded-full font-medium border border-gray-700">Captain</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 text-gray-100">Team Actions</h4>
                        <div className="space-y-2">
                          {isCaptain && (
                            <Button asChild variant="outline" size="sm" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent">
                              <Link href="/manage-team">Manage Team</Link>
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent">
                            <Link href={`/teams/${userTeam.id}`}>View Team Page</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent">
                            <Link href="/tournaments">Find Tournaments</Link>
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-gray-100">Quick Stats</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rank:</span>
                            <span className="font-medium text-gray-300">{userTeam.rank || 'Unranked'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Region:</span>
                            <span className="font-medium text-gray-300">{userTeam.region || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Members:</span>
                            <span className="font-medium text-gray-300">{userTeam.current_size || 0}/5</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-gray-100">Looking For</h4>
                        <div className="flex flex-wrap gap-2">
                          {userTeam.looking_for ? (
                            userTeam.looking_for.split(',').map((role: string, idx: number) => (
                              <span key={idx} className="text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded-full font-medium border border-gray-700">
                                {role.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">Not recruiting</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="px-4 py-32 bg-black">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-5xl font-bold text-center mb-24 text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">What's New</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {/* Upcoming Tournaments */}
              <Card className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 border-none border-t-2 border-t-yellow-500 shadow-2xl relative overflow-visible group mt-10">
                <CardHeader className="text-center pb-4 pt-20 relative z-10">
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40">
                    {/* Ambient Glow */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-yellow-500/20 blur-[50px] rounded-full group-hover:bg-yellow-500/40 transition-all duration-500" />
                    <img
                      src="/Hextech_Crafting_Masterwork_Chest.webp"
                      alt="Tournaments"
                      className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(234,179,8,0.7)] group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 transform"
                    />
                  </div>
                  <CardTitle className="text-3xl font-bold text-white tracking-tight">Upcoming Tournaments</CardTitle>
                </CardHeader>
                <CardContent className="text-center relative z-10">
                  <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                    Check out the latest tournaments you can join with your team and win exclusive rewards.
                  </p>
                  <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-yellow-600 hover:border-yellow-600 hover:text-white transition-all px-8 py-6 text-sm font-bold tracking-wide bg-transparent">
                    <Link href="/tournaments">View All</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Looking for Players */}
              <Card className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 border-none border-t-2 border-t-cyan-500 shadow-2xl relative overflow-visible group mt-10">
                <CardHeader className="text-center pb-4 pt-20 relative z-10">
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40">
                    {/* Ambient Glow */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-cyan-500/20 blur-[50px] rounded-full group-hover:bg-cyan-500/40 transition-all duration-500" />
                    <img
                      src="/LoR_Rare_Wildcard_icon.webp"
                      alt="Players"
                      className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(34,211,238,0.7)] group-hover:scale-110 group-hover:-translate-y-2 rotate-12 group-hover:rotate-6 transition-all duration-500 transform"
                    />
                  </div>
                  <CardTitle className="text-3xl font-bold text-white tracking-tight">Looking for Players</CardTitle>
                </CardHeader>
                <CardContent className="text-center relative z-10">
                  <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                    Teams are actively looking for players in your rank range. Find your perfect squad today.
                  </p>
                  <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-cyan-600 hover:border-cyan-600 hover:text-white transition-all px-8 py-6 text-sm font-bold tracking-wide bg-transparent">
                    <Link href="/teams">Find Teams</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Matches */}
              <Card className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 border-none border-t-2 border-t-red-500 shadow-2xl relative overflow-visible group mt-10">
                <CardHeader className="text-center pb-4 pt-20 relative z-10">
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 h-40">
                    {/* Ambient Glow */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full bg-red-500/20 blur-[50px] rounded-full group-hover:bg-red-500/40 transition-all duration-500" />
                    <img
                      src="/LoR_Blue_Nexus.webp"
                      alt="Matches"
                      className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(239,68,68,0.7)] group-hover:scale-125 group-hover:-translate-y-4 transition-all duration-500 transform"
                    />
                  </div>
                  <CardTitle className="text-3xl font-bold text-white tracking-tight">Recent Matches</CardTitle>
                </CardHeader>
                <CardContent className="text-center relative z-10">
                  <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                    Stay updated with the latest tournament results, match replays, and team performance.
                  </p>
                  <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-red-600 hover:border-red-600 hover:text-white transition-all px-8 py-5 text-sm font-bold tracking-wide bg-transparent">
                    <Link href="/tournaments">View Results</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
