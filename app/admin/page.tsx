import { redirect } from 'next/navigation'
import { getCurrentAdminUser } from '@/lib/admin-check'
import AdminTabs from '@/components/admin/AdminTabs'
import { Suspense } from 'react'

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
          <Suspense fallback={<div className="p-8 text-center">Loading admin dashboard...</div>}>
            <AdminTabs stats={stats} />
          </Suspense>

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