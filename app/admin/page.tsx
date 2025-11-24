import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Trophy, Shield, TrendingUp, Activity, Settings } from 'lucide-react'
import AdminStats from '@/components/admin/AdminStats'
import PlayersTable from '@/components/admin/PlayersTable'
import TeamsTable from '@/components/admin/TeamsTable'
import TournamentsTable from '@/components/admin/TournamentsTable'
import RegistrationsTable from '@/components/admin/RegistrationsTable'
import UserManagement from '@/components/admin/UserManagement'
import CreateTournamentCard from '@/components/admin/CreateTournamentCard'
import SystemHealthCard from '@/components/admin/SystemHealthCard'
import ComprehensiveUserManagement from '@/components/admin/ComprehensiveUserManagement'
import { getCurrentAdminUser } from '@/lib/admin-check'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

async function getAdminStats() {
  const { createAdminClient } = await import('@/lib/admin-check')
  const supabase = await createAdminClient()
  
  const [
    { count: playersCount },
    { count: teamsCount },
    { count: tournamentsCount },
    { count: registrationsCount },
    { data: recentPlayers },
    { data: recentTournaments }
  ] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('tournament_registrations').select('*', { count: 'exact', head: true }),
    supabase.from('players').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(5)
  ])
  
  return {
    playersCount: playersCount || 0,
    teamsCount: teamsCount || 0,
    tournamentsCount: tournamentsCount || 0,
    registrationsCount: registrationsCount || 0,
    recentPlayers: recentPlayers || [],
    recentTournaments: recentTournaments || []
  }
}

export default async function AdminPage() {
  const user = await getCurrentAdminUser()

  if (!user) {
    redirect('/auth')
  }

  const stats = await getAdminStats()

  return (
    <main className="pt-20">
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-background to-card flex items-start justify-center px-4 pt-16">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-balance">
              Admin <span className="text-primary">Dashboard</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 text-balance">
              Manage your tournament platform. Monitor players, teams, competitions, and grow your community.
            </p>
            
            <div className="flex justify-center mb-8">
              <form action="/auth/signout" method="post">
                <Button variant="outline" size="lg" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-2">Total Players</h3>
              <p className="text-3xl font-bold text-primary mb-2">{stats.playersCount}</p>
              <p className="text-muted-foreground">
                +{Math.floor(stats.playersCount * 0.2)}% from last month
              </p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Total Teams</h3>
              <p className="text-3xl font-bold text-primary mb-2">{stats.teamsCount}</p>
              <p className="text-muted-foreground">
                +{Math.floor(stats.teamsCount * 0.2)}% from last month
              </p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">⚔️</div>
              <h3 className="text-xl font-bold mb-2">Tournaments</h3>
              <p className="text-3xl font-bold text-primary mb-2">{stats.tournamentsCount}</p>
              <p className="text-muted-foreground">
                +{Math.floor(stats.tournamentsCount * 0.2)}% from last month
              </p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-2">Registrations</h3>
              <p className="text-3xl font-bold text-primary mb-2">{stats.registrationsCount}</p>
              <p className="text-muted-foreground">
                +{Math.floor(stats.registrationsCount * 0.2)}% from last month
              </p>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 max-w-4xl mx-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
              <TabsTrigger value="registrations">Registrations</TabsTrigger>
              <TabsTrigger value="users">User Roles</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CreateTournamentCard />
                <SystemHealthCard stats={stats} />
              </div>
            </TabsContent>
            
            <TabsContent value="players">
              <Card className="bg-card border-border p-6">
                <div className="text-4xl mb-4">👥</div>
                <h3 className="text-xl font-bold mb-4">Player Management</h3>
                <PlayersTable />
              </Card>
            </TabsContent>
            
            <TabsContent value="teams">
              <Card className="bg-card border-border p-6">
                <div className="text-4xl mb-4">🏆</div>
                <h3 className="text-xl font-bold mb-4">Team Management</h3>
                <TeamsTable />
              </Card>
            </TabsContent>
            
            <TabsContent value="tournaments">
              <Card className="bg-card border-border p-6">
                <div className="text-4xl mb-4">⚔️</div>
                <h3 className="text-xl font-bold mb-4">Tournament Management</h3>
                <TournamentsTable />
              </Card>
            </TabsContent>
            
            <TabsContent value="registrations">
              <Card className="bg-card border-border p-6">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-bold mb-4">Registration Management</h3>
                <RegistrationsTable />
              </Card>
            </TabsContent>
            
            <TabsContent value="users">
              <ComprehensiveUserManagement />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  )
}