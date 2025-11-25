'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle } from 'lucide-react'

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
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [registrationStatuses, setRegistrationStatuses] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Get user's team if captain
      if (authUser) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('*')
          .eq('captain_id', authUser.id)
          .single()
        
        setUserTeam(teamData)

        // Get registered tournaments for this team with status
        if (teamData) {
          const { data: registrations } = await supabase
            .from('tournament_registrations')
            .select('tournament_id, status')
            .eq('team_id', teamData.id)
          
          const statusMap: Record<string, string> = {}
          registrations?.forEach(reg => {
            // Normalize status to lowercase for consistent comparison
            statusMap[reg.tournament_id] = (reg.status || 'pending').toLowerCase()
          })
          setRegistrationStatuses(statusMap)
        }
      }

      // Fetch tournaments
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

  const handleRegister = async (tournamentId: string) => {
    if (!userTeam) return

    // Prevent double-clicking
    if (registering === tournamentId) return

    setRegistering(tournamentId)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/tournament-registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          tournament_id: tournamentId,
          team_id: userTeam.id,
        }),
      })

      if (response.ok) {
        // Add to registration statuses as pending
        setRegistrationStatuses(prev => ({ ...prev, [tournamentId]: 'pending' }))
        setSuccessMessage('Registration submitted! Your team registration is pending admin approval.')
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        const error = await response.json()
        console.error('Error registering for tournament:', error.error)
        
        // If it's a duplicate registration error, update the status to pending
        if (error.error?.includes('pending') || error.error?.includes('already')) {
          setRegistrationStatuses(prev => ({ ...prev, [tournamentId]: 'pending' }))
        }
        
        setErrorMessage(error.error || "Failed to register for tournament.")
      }
    } catch (error: any) {
      console.error('Error registering for tournament:', error)
      setErrorMessage(error.message || "An unexpected error occurred.")
    } finally {
      setRegistering(null)
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

        {/* Success Message */}
        {successMessage && (
          <Alert className="mb-6 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {errorMessage && (
          <Alert className="mb-6 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

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

                    {user && userTeam ? (
                      registrationStatuses[tournament.id] === 'approved' ? (
                        <Button disabled className="bg-green-600">
                          ✓ Registered
                        </Button>
                      ) : registrationStatuses[tournament.id] === 'pending' ? (
                        <Button disabled className="bg-yellow-600">
                          ⏳ Pending Approval
                        </Button>
                      ) : registrationStatuses[tournament.id] === 'rejected' ? (
                        <Button disabled className="bg-red-600">
                          ✗ Registration Declined
                        </Button>
                      ) : tournamentStatus.status === 'upcoming' ? (
                        <Button 
                          onClick={() => handleRegister(tournament.id)}
                          disabled={registering === tournament.id}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {registering === tournament.id ? 'Registering...' : 'Register Team'}
                        </Button>
                      ) : (
                        <Button disabled className="bg-muted">
                          Registration Closed
                        </Button>
                      )
                    ) : (
                      <Button disabled className="bg-muted">
                        {user ? 'Create a Team First' : 'Sign In to Register'}
                      </Button>
                    )}
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
