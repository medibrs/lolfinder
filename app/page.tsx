import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Trophy, Users, Target, Zap, Shield, Crown } from 'lucide-react'

export default function Home() {
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-12">
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">500+</div>
              <div className="text-sm text-muted-foreground">Active Players</div>
            </div>
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">100+</div>
              <div className="text-sm text-muted-foreground">Teams Formed</div>
            </div>
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">50+</div>
              <div className="text-sm text-muted-foreground">Tournaments</div>
            </div>
            <div className="p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">$10k+</div>
              <div className="text-sm text-muted-foreground">Prize Pool</div>
            </div>
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
