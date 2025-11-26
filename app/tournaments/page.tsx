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
            // Normalize status to lowercase and map 'confirmed' to 'approved' for consistency
            let status = (reg.status || 'pending').toLowerCase()
            if (status === 'confirmed') status = 'approved'
            statusMap[reg.tournament_id] = status
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
    <main className="min-h-screen pt-24 pb-12 bg-background">
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
          <div className="grid grid-cols-1 gap-4">
            {tournaments.length > 0 ? (
              tournaments.map(tournament => {
                const tournamentStatus = getTournamentStatus(tournament.start_date, tournament.end_date)
                const startDate = new Date(tournament.start_date)
                const endDate = new Date(tournament.end_date)
                const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                
                return (
                  <Card key={tournament.id} className="relative border-zinc-800 overflow-hidden hover:border-zinc-700 transition-all duration-300 group p-0">
                    {/* Full Card Background Image */}
                    <div 
                      className="absolute inset-0 bg-cover bg-top"
                      style={{
                        backgroundImage: 'url(/leet_lol_header.jpg)',
                        filter: 'brightness(0.6)'
                      }}
                    />
                    
                    {/* Tournament Header */}
                    <div className="relative h-28 md:h-32">
                      <div className="relative h-full flex flex-col justify-end p-4 md:p-6">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg md:text-2xl font-bold text-white group-hover:text-primary transition-colors drop-shadow-lg line-clamp-2">{tournament.name}</h3>
                            <div className="flex-shrink-0">
                              {tournamentStatus.status === 'upcoming' && (
                                <span className="px-2 md:px-3 py-1 rounded-md font-semibold text-xs bg-orange-600 text-white whitespace-nowrap shadow-lg">
                                  Upcoming
                                </span>
                              )}
                              {tournamentStatus.status === 'in-progress' && (
                                <span className="px-2 md:px-3 py-1 rounded-md font-semibold text-xs bg-green-600 text-white whitespace-nowrap animate-pulse shadow-lg">
                                  Live
                                </span>
                              )}
                              {tournamentStatus.status === 'completed' && (
                                <span className="px-2 md:px-3 py-1 rounded-md font-semibold text-xs bg-zinc-700 text-zinc-300 whitespace-nowrap shadow-lg">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-zinc-300 text-xs md:text-sm drop-shadow-md line-clamp-2">{tournament.description || 'No description available'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tournament Details - Compact blur section */}
                    <div className="relative px-4 md:px-6 py-3 bg-zinc-900/60 backdrop-blur-sm border-t border-zinc-700/50">
                      <div className="grid grid-cols-3 gap-2 md:gap-8 mb-3">
                        <div className="text-center md:text-left">
                          <p className="text-zinc-400 text-[10px] md:text-xs uppercase tracking-wider">Date</p>
                          <p className="text-white font-semibold text-xs md:text-sm">{dateRange}</p>
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-zinc-400 text-[10px] md:text-xs uppercase tracking-wider">Prize</p>
                          <p className="text-white font-semibold text-xs md:text-sm">{tournament.prize_pool || 'TBD'}</p>
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-zinc-400 text-[10px] md:text-xs uppercase tracking-wider">Teams</p>
                          <p className="text-orange-500 font-semibold text-xs md:text-sm">{tournament.max_teams}</p>
                        </div>
                      </div>

                      {/* Registration Button */}
                      {user && userTeam ? (
                        registrationStatuses[tournament.id] === 'approved' ? (
                          <div className="w-full py-2.5 px-4 rounded-md bg-green-600/20 border border-green-600/50 text-green-400 font-semibold text-sm text-center flex items-center justify-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Registered
                          </div>
                        ) : registrationStatuses[tournament.id] === 'pending' ? (
                          <div className="w-full py-2.5 px-4 rounded-md bg-yellow-600/20 border border-yellow-600/50 text-yellow-400 font-semibold text-sm text-center">
                            ⏳ Pending Approval
                          </div>
                        ) : registrationStatuses[tournament.id] === 'rejected' ? (
                          <div className="w-full py-2.5 px-4 rounded-md bg-red-600/20 border border-red-600/50 text-red-400 font-semibold text-sm text-center flex items-center justify-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Registration Declined
                          </div>
                        ) : tournamentStatus.status === 'upcoming' ? (
                          <Button 
                            onClick={() => handleRegister(tournament.id)}
                            disabled={registering === tournament.id}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                          >
                            {registering === tournament.id ? 'Registering...' : 'Register Team'}
                          </Button>
                        ) : (
                          <div className="w-full py-2.5 px-4 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-500 font-semibold text-sm text-center">
                            Registration Closed
                          </div>
                        )
                      ) : user ? (
                        <div className="w-full py-2.5 px-4 rounded-md bg-zinc-800/50 border border-zinc-700 text-zinc-400 font-semibold text-sm text-center">
                          Create a Team First
                        </div>
                      ) : null}
                    </div>
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
