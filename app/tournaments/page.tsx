'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Tournament {
  id: string
  name: string
  description?: string
  max_teams: number
  start_date: string
  end_date: string
  prize_pool?: string
  rules?: string
  created_at: string
  updated_at: string
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tournaments:', error)
        return
      }

      setTournaments(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTournamentStatus = (startDate: string, endDate: string) => {
    const now = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (now < start) {
      return { status: 'upcoming', color: 'bg-accent text-accent-foreground' }
    } else if (now >= start && now <= end) {
      return { status: 'in-progress', color: 'bg-primary text-primary-foreground' }
    } else {
      return { status: 'completed', color: 'bg-muted text-muted-foreground' }
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Tournaments</h1>
        <p className="text-muted-foreground mb-8">Browse and register for upcoming tournaments</p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {tournaments.length > 0 ? (
              tournaments.map(tournament => {
                const tournamentStatus = getTournamentStatus(tournament.start_date, tournament.end_date)
                return (
                  <Card key={tournament.id} className="bg-card border-border p-8 hover:border-primary transition">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-2">{tournament.name}</h3>
                        <p className="text-muted-foreground mb-4">{tournament.description || 'No description available'}</p>
                      </div>
                      <span className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${tournamentStatus.color}`}>
                        {tournamentStatus.status.charAt(0).toUpperCase() + tournamentStatus.status.slice(1).replace('-', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 py-4 border-y border-border">
                      <div>
                        <p className="text-muted-foreground text-sm">Start Date</p>
                        <p className="font-semibold">{new Date(tournament.start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">Max Teams</p>
                        <p className="font-semibold text-accent">{tournament.max_teams} teams</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">Prize Pool</p>
                        <p className="font-semibold">{tournament.prize_pool || 'Not specified'}</p>
                      </div>
                    </div>

                    <Button className="bg-primary hover:bg-primary/90">
                      {tournamentStatus.status === 'upcoming' ? 'Register Team' : 'View Details'}
                    </Button>
                  </Card>
                )
              })
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tournaments available at the moment.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
