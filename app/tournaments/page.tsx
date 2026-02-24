'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, XCircle, Calendar, Clock, Trophy, Users, User, Coins } from 'lucide-react'
import Link from 'next/link'

interface Tournament {
  id: string
  name: string
  description?: string
  max_teams: number
  start_date: string
  end_date: string
  prize_pool?: string
  rules?: string
  tournament_number?: number
  banner_image?: string
  created_at: string
  updated_at: string
  tournament_participants?: { count: number }[]
}

export default function TournamentsPage() {
  const router = useRouter()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [registrationStatuses, setRegistrationStatuses] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const supabase = createClient()

  // Generate URL-friendly slug from tournament name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim()
  }

  // Navigate to tournament event page
  const handleTournamentClick = (tournament: Tournament) => {
    const slug = generateSlug(tournament.name)
    const tournamentId = tournament.tournament_number || tournament.id
    router.push(`/tournaments/${tournamentId}/${slug}`)
  }

  useEffect(() => {
    fetchData()

    // Refetch data when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also refetch every 60 seconds to keep data fresh
    const interval = setInterval(() => {
      fetchData()
    }, 60000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(interval)
    }
  }, [])

  const fetchData = async () => {
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Get user's team if captain
      if (authUser) {
        // First check if user has a player profile
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', authUser.id)
          .single()

        if (playerError) {
          setHasPlayerProfile(false)
          setProfileChecked(true)
        } else {
          setHasPlayerProfile(true)
          setProfileChecked(true)
        }

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
      } else {
        // No authenticated user
        setProfileChecked(true)
      }

      // Fetch tournaments data
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_participants(count)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        return
      }

      setTournaments(data || [])
    } catch (error) {
    } finally {
      setInitialLoad(false) // Mark initial load as complete
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

        // If it's a duplicate registration error, update the status to pending
        if (error.error?.includes('pending') || error.error?.includes('already')) {
          setRegistrationStatuses(prev => ({ ...prev, [tournamentId]: 'pending' }))
        }

        setErrorMessage(error.error || "Failed to register for tournament.")
      }
    } catch (error: any) {
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
    <main className="min-h-screen pt-24 pb-12 bg-gradient-to-b from-background to-secondary/20 text-white">
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-5xl font-bold mb-3 font-beaufort tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] uppercase">
              Tournament Arena
            </h1>
            <p className="text-gray-400 uppercase tracking-[0.3em] font-beaufort text-sm">
              Forge your legacy and compete for elite rewards
            </p>
          </div>
        </div>

        {/* Profile Setup Banner */}
        {user && !hasPlayerProfile && profileChecked && (
          <div className="mb-8 p-6 bg-slate-900/60 backdrop-blur-md border border-cyan-500/30 rounded-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-beaufort tracking-wide">Complete Your Profile</h3>
                  <p className="text-slate-400 text-sm">Unlock registration for upcoming competitive events.</p>
                </div>
              </div>
              <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 py-6 rounded-lg shadow-[0_0_15px_rgba(8,145,178,0.3)] transition-all">
                <Link href="/setup-profile">Set Up Profile Now</Link>
              </Button>
            </div>
          </div>
        )}

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

        {initialLoad ? (
          <div className="flex flex-col gap-10">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="flex flex-col border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden">
                <Skeleton className="w-full aspect-[29/9] bg-slate-800" />
                <div className="px-6 lg:px-10 py-6 flex flex-row items-center justify-between gap-8">
                  <div className="flex gap-12">
                    <Skeleton className="h-10 w-24 bg-slate-800 rounded" />
                    <Skeleton className="h-10 w-24 bg-slate-800 rounded" />
                    <Skeleton className="h-10 w-24 bg-slate-800 rounded" />
                  </div>
                  <Skeleton className="h-10 w-32 bg-slate-800 rounded mt-auto" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {tournaments.length > 0 ? (
              tournaments.map(tournament => {
                const participantCount = tournament.tournament_participants?.[0]?.count || 0
                const tournamentStatus = getTournamentStatus(tournament.start_date, tournament.end_date)
                const startDate = new Date(tournament.start_date)
                const endDate = new Date(tournament.end_date)

                return (
                  <Card
                    key={tournament.id}
                    className="flex flex-col w-full border-slate-800 bg-slate-900 overflow-hidden hover:border-yellow-500/50 transition-all duration-300 group cursor-pointer shadow-2xl relative p-0 gap-0"
                    onClick={() => handleTournamentClick(tournament)}
                  >
                    {/* TOP SECTION: Cinematic Ultrawide Image (29:9) */}
                    <div className="relative w-full aspect-[2.5/1] md:aspect-[29/9] overflow-hidden bg-slate-950 flex-shrink-0">
                      <img
                        src={tournament.banner_image || '/leet_lol_header.jpg'}
                        alt={tournament.name}
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-80 group-hover:opacity-100"
                      />

                      {/* Floating Status Badge (Top Right - Flushed Top) */}
                      <div className="absolute top-0 right-20 z-20">
                        {tournamentStatus.status === 'upcoming' && (
                          <img src="/tournament_assets/upcoming_small.png" alt="Upcoming" className="h-[100px] w-auto drop-shadow-2xl" />
                        )}
                        {tournamentStatus.status === 'in-progress' && (
                          <img src="/tournament_assets/live_small.png" alt="Live Now" className="h-[100px] w-auto drop-shadow-2xl animate-pulse" />
                        )}
                        {tournamentStatus.status === 'completed' && (
                          <img src="/tournament_assets/ended_small.png" alt="Completed" className="h-[100px] w-auto opacity-80" />
                        )}
                      </div>

                      {/* FIXED TITLE: Left-aligned with proper inset and scaled down */}
                      <div className="absolute bottom-0 left-0 w-full px-8 pb-3 md:pb-4 z-10 text-left">
                        <h2 className="text-base md:text-xl lg:text-2xl font-bold text-white uppercase tracking-wider font-beaufort drop-shadow-[0_4px_12px_rgba(0,0,0,1)] group-hover:text-yellow-500 transition-colors leading-tight">
                          {tournament.name}
                        </h2>
                      </div>
                    </div>

                    {/* BOTTOM SECTION: Rigid Stats Strip - Consistent inset */}
                    <div className="w-full px-8 py-3 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t-0">

                      {/* Stats Flex Grid */}
                      <div className="flex flex-row flex-wrap items-center gap-8 lg:gap-16">
                        {/* Stat 1: Date */}
                        <div className="flex flex-row items-center gap-3">
                          <Calendar className="h-5 w-5 text-slate-500" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-0.5 font-sans">Date</span>
                            <span className="text-xs md:text-sm text-slate-200 font-bold uppercase tracking-wide">
                              {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Stat 2: Prize Pool */}
                        <div className="flex flex-row items-center gap-3">
                          <img src="/tournament_assets/trophy_small.png" alt="Prize" className="h-5 w-auto" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-0.5 font-sans">Prize Pool</span>
                            <span className="text-xs md:text-sm text-yellow-500 font-bold">{tournament.prize_pool || 'TBD'}</span>
                          </div>
                        </div>

                        {/* Stat 3: Contestants */}
                        <div className="flex flex-row items-center gap-3">
                          <img src="/tournament_assets/teams_small.png" alt="Teams" className="h-5 w-auto" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-0.5 font-sans">Teams</span>
                            <span className="text-xs md:text-sm text-slate-200 font-bold">{participantCount} / {tournament.max_teams}</span>
                          </div>
                        </div>

                        {/* Stat 4: Format / Server */}
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-0.5 font-sans">Server</span>
                          <div className="flex items-center gap-2 text-xs md:text-sm text-slate-200 font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" /> EUW
                          </div>
                        </div>
                      </div>

                      {/* Call to Action Button */}
                      <div className="md:ml-auto">
                        {user && userTeam ? (
                          registrationStatuses[tournament.id] === 'approved' ? (
                            <div className="px-6 py-2 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-[10px] uppercase tracking-widest shadow-inner">
                              <CheckCircle className="h-3.5 w-3.5 inline mr-2" /> Confirmed
                            </div>
                          ) : registrationStatuses[tournament.id] === 'pending' ? (
                            <div className="px-6 py-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-bold text-[10px] uppercase tracking-widest shadow-inner">
                              <Clock className="h-3.5 w-3.5 inline mr-2" /> Pending
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRegister(tournament.id)
                              }}
                              disabled={registering === tournament.id}
                              style={{
                                backgroundImage: `url(${registering === tournament.id ? '/tournament_assets/regester_button_pressed_small.png' : '/tournament_assets/regester_button_small.png'})`,
                                backgroundSize: '100% 100%'
                              }}
                              className="group/btn relative h-14 w-52 bg-no-repeat bg-center flex items-center justify-center transition-all active:scale-95 hover:brightness-125 disabled:grayscale"
                            >
                              <span className="text-slate-950 font-bold text-xs tracking-[0.15em] uppercase drop-shadow-sm mt-0.5 group-active/btn:mt-1 group-active/btn:text-slate-900 transition-all">
                                {registering === tournament.id ? 'TRANSMITTING' : 'Register Squad'}
                              </span>
                            </button>
                          )
                        ) : (
                          <Button
                            className="px-8 py-3 bg-transparent border border-slate-700 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] rounded-none hover:border-yellow-500 hover:text-yellow-500 transition-all font-beaufort"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push('/auth')
                            }}
                          >
                            Login to Compete
                          </Button>
                        )}
                      </div>
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
