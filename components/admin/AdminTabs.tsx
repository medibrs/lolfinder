'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PlayersTable from '@/components/admin/PlayersTable'
import TeamsTable from '@/components/admin/TeamsTable'
import TournamentsTable from '@/components/admin/TournamentsTable'
import RegistrationsTable from '@/components/admin/RegistrationsTable'
import FeatureRequestsTable from '@/components/admin/FeatureRequestsTable'
import CreateTournamentCard from '@/components/admin/CreateTournamentCard'
import SystemHealthCard from '@/components/admin/SystemHealthCard'
import ComprehensiveUserManagement from '@/components/admin/ComprehensiveUserManagement'
import RiotApiStatsCard from '@/components/admin/RiotApiStatsCard'
import { createClient } from '@/lib/supabase/client'

interface AdminTabsProps {
  stats: {
    playersCount: number
    teamsCount: number
    tournamentsCount: number
    registrationsCount: number
    featureRequestsCount: number
    recentPlayers: any[]
    recentTournaments: any[]
  }
}

// Riot Data Update Component
function RiotDataUpdateCard() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<any>(null)
  const supabase = createClient()

  const handleUpdateAllPlayers = async () => {
    if (!confirm('This will update all players with fresh Riot API data. This may take several minutes. Continue?')) {
      return
    }

    setIsUpdating(true)
    setUpdateResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/admin/update-all-players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      const result = await response.json()
      setUpdateResult(result)

      if (!response.ok) {

      }
    } catch (error) {

      setUpdateResult({ error: 'Failed to update players' })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="text-4xl mb-4">🔄</div>
      <h3 className="text-xl font-bold mb-4">Riot Data Update</h3>
      <p className="text-muted-foreground mb-4">
        Update all registered players with fresh Riot API data including rank, wins, losses, and profile icons.
      </p>

      <Button
        onClick={handleUpdateAllPlayers}
        disabled={isUpdating}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {isUpdating ? 'Updating Players...' : 'Update All Players'}
      </Button>

      {updateResult && (
        <div className="mt-4 p-3 bg-muted rounded">
          {updateResult.error ? (
            <p className="text-red-400 text-sm">Error: {updateResult.error}</p>
          ) : (
            <div className="text-sm">
              <p className="text-green-400 font-semibold mb-2">
                Update Complete! ✅
              </p>
              <div className="space-y-1">
                <p>Total Players: {updateResult.summary?.total}</p>
                <p className="text-green-400">Success: {updateResult.summary?.success}</p>
                <p className="text-red-400">Failed: {updateResult.summary?.failed}</p>
              </div>

              {updateResult.errors && updateResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">View Errors</summary>
                  <div className="mt-1 space-y-1">
                    {updateResult.errors.slice(0, 5).map((error: string, i: number) => (
                      <p key={i} className="text-xs text-red-300">{error}</p>
                    ))}
                    {updateResult.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">...and {updateResult.errors.length - 5} more</p>
                    )}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function AdminTabs({ stats }: AdminTabsProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  return (
    <div className="space-y-6">
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <CreateTournamentCard />
            <SystemHealthCard stats={stats} />
          </div>
          <div className="space-y-6">
            <RiotApiStatsCard />
            <RiotDataUpdateCard />
          </div>
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
        <Card className="bg-card border-border p-0">
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

      {activeTab === 'feature-requests' && (
        <Card className="bg-card border-border p-6">
          <div className="text-4xl mb-4">💡</div>
          <h3 className="text-xl font-bold mb-4">Feature Request Management</h3>
          <p className="text-muted-foreground mb-6">
            Manage and respond to user-submitted feature requests. Total requests: {stats.featureRequestsCount}
          </p>
          <FeatureRequestsTable />
        </Card>
      )}
    </div>
  )
}
