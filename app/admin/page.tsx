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
      <section className="bg-gradient-to-b from-background to-card px-4 py-6">
        <div className="max-w-6xl mx-auto w-full">
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

          {/* Compact Stats at Bottom */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg">
              <span className="text-lg">👥</span>
              <div>
                <p className="text-xs text-muted-foreground">Players</p>
                <p className="text-lg font-bold text-primary">{stats.playersCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-xs text-muted-foreground">Teams</p>
                <p className="text-lg font-bold text-primary">{stats.teamsCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg">
              <span className="text-lg">⚔️</span>
              <div>
                <p className="text-xs text-muted-foreground">Tournaments</p>
                <p className="text-lg font-bold text-primary">{stats.tournamentsCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg">
              <span className="text-lg">📊</span>
              <div>
                <p className="text-xs text-muted-foreground">Registrations</p>
                <p className="text-lg font-bold text-primary">{stats.registrationsCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}