"use client"

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users, Target, Zap, Shield, Crown, Bell, Settings, Plus, Search, Calendar, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [isCaptain, setIsCaptain] = useState(false)
  const [playerProfile, setPlayerProfile] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Fetch user's player profile (includes Riot Games name)
        const { data: profileData } = await supabase
          .from('players')
          .select('*')
          .eq('user_id', user.id)
          .single()
        
        if (profileData) {
          setPlayerProfile(profileData)
        }

        // Fetch user's team
        const { data: playerData } = await supabase
          .from('players')
          .select('teams(*)')
          .eq('user_id', user.id)
          .single()
        
        if (playerData?.teams && Array.isArray(playerData.teams) && playerData.teams.length > 0) {
          const team = playerData.teams[0]
          setUserTeam(team)
          setIsCaptain(team.captain_id === user.id)
        }
      }
      
      setLoading(false)
    }

    getUser()
  }, [])

  if (loading) {
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
            Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Perfect Team</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 text-balance max-w-3xl mx-auto">
            Join the ultimate League of Legends community. Create teams, compete in tournaments, and climb the ranks together.
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

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-card">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Compete?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of players building teams and competing in tournaments
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
    <main className="pt-16 min-h-screen">
      {/* Welcome Header */}
      <section className="bg-gradient-to-b from-primary/5 to-background px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Welcome back, {playerProfile?.riot_games_name || 'Summoner'}! 👋
              </h1>
              <p className="text-muted-foreground text-lg">
                Ready to dominate the Rift? Here's what's happening with your team.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/teams" className="block p-6">
                <Users className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Browse Teams</h3>
                <p className="text-sm text-muted-foreground">Find teams looking for players</p>
              </Link>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/tournaments" className="block p-6">
                <Trophy className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Tournaments</h3>
                <p className="text-sm text-muted-foreground">View upcoming competitions</p>
              </Link>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/search" className="block p-6">
                <Search className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Search Players</h3>
                <p className="text-sm text-muted-foreground">Find teammates by rank/role</p>
              </Link>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link href="/players" className="block p-6">
                <User className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Player Directory</h3>
                <p className="text-sm text-muted-foreground">Browse all players</p>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Status */}
      <section className="px-4 py-8 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Your Team Status</h2>
          
          {userTeam ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  {userTeam.name}
                  {isCaptain && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Captain</span>}
                </CardTitle>
                <CardDescription>
                  {userTeam.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Team Actions</h4>
                    <div className="space-y-2">
                      {isCaptain && (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href="/manage-team">Manage Team</Link>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/teams/${userTeam.id}`}>View Team Page</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href="/tournaments">Find Tournaments</Link>
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Quick Stats</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rank:</span>
                        <span>{userTeam.rank || 'Unranked'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Region:</span>
                        <span>{userTeam.region || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Members:</span>
                        <span>{userTeam.current_size || 0}/5</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Looking For</h4>
                    <div className="flex flex-wrap gap-1">
                      {userTeam.looking_for ? (
                        userTeam.looking_for.split(',').map((role: string, idx: number) => (
                          <span key={idx} className="text-xs bg-secondary px-2 py-1 rounded">
                            {role.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Not recruiting</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Create a Team
                  </CardTitle>
                  <CardDescription>
                    Start your own team and recruit players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/create-team">Create New Team</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Join a Team
                  </CardTitle>
                  <CardDescription>
                    Find existing teams looking for players
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/teams">Browse Teams</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">What's New</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5" />
                  Upcoming Tournaments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Check out the latest tournaments you can join with your team.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/tournaments">View All</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5" />
                  Looking for Players
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Teams are actively looking for players in your rank range.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/teams">Find Teams</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5" />
                  Recent Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Stay updated with the latest tournament results and matches.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/tournaments">View Results</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
