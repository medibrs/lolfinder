'use client'

import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import PlayersTable from '@/components/admin/PlayersTable'
import TeamsTable from '@/components/admin/TeamsTable'
import TournamentsTable from '@/components/admin/TournamentsTable'
import RegistrationsTable from '@/components/admin/RegistrationsTable'
import CreateTournamentCard from '@/components/admin/CreateTournamentCard'
import SystemHealthCard from '@/components/admin/SystemHealthCard'
import ComprehensiveUserManagement from '@/components/admin/ComprehensiveUserManagement'

interface AdminTabsProps {
  stats: {
    playersCount: number
    teamsCount: number
    tournamentsCount: number
    registrationsCount: number
    recentPlayers: any[]
    recentTournaments: any[]
  }
}

export default function AdminTabs({ stats }: AdminTabsProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  return (
    <div className="space-y-6">
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CreateTournamentCard />
          <SystemHealthCard stats={stats} />
        </div>
      )}

      {activeTab === 'players' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-xl font-bold mb-4">Player Management</h3>
          <PlayersTable />
        </Card>
      )}

      {activeTab === 'teams' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-xl font-bold mb-4">Team Management</h3>
          <TeamsTable />
        </Card>
      )}

      {activeTab === 'tournaments' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">🎮</div>
          <h3 className="text-xl font-bold mb-4">Tournament Management</h3>
          <TournamentsTable />
        </Card>
      )}

      {activeTab === 'registrations' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-xl font-bold mb-4">Registration Management</h3>
          <RegistrationsTable />
        </Card>
      )}

      {activeTab === 'users' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-xl font-bold mb-4">User Role Management</h3>
          <ComprehensiveUserManagement />
        </Card>
      )}
    </div>
  )
}
