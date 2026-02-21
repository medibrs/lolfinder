'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, XCircle, Calendar, Clock, Trophy, Users } from 'lucide-react'

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
    <main className="min-h-screen pt-24 pb-12 bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Tournaments</h1>
        <p className="text-muted-foreground mb-8">Browse and register for upcoming tournaments</p>

        {/* Profile Setup Banner */}
        {user && !hasPlayerProfile && profileChecked && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">Complete Your Player Profile</h3>
                  <p className="text-sm text-blue-700">Create your profile to join teams and participate in tournaments</p>
                </div>
              </div>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href="/setup-profile">Set Up Profile</a>
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
          <div className="grid grid-cols-1 gap-4">
            {/* Skeleton loaders for tournaments - matching card preview design */}
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="relative border-zinc-800/50 overflow-hidden group p-0 min-h-[300px] md:min-h-[360px] flex flex-col justify-between bg-zinc-900/50">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70 pointer-events-none" />

                {/* Header Skeleton */}
                <div className="relative p-6 md:p-8 z-10 w-full">
                  <div className="flex items-start justify-between gap-4">
                    <Skeleton className="h-10 w-2/3 md:w-1/2 bg-white/10 rounded-lg" />
                    <Skeleton className="h-8 w-24 bg-white/10 rounded-full" />
                  </div>
                </div>

                {/* Footer Skeleton */}
                <div className="relative p-6 md:p-8 z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6 mt-auto">
                  <Skeleton className="h-[76px] w-full xl:w-[450px] bg-white/5 rounded-2xl" />
                  <Skeleton className="h-[60px] w-full xl:w-[200px] bg-white/10 rounded-2xl" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tournaments.length > 0 ? (
              tournaments.map(tournament => {
                const participantCount = tournament.tournament_participants?.[0]?.count || 0
                const tournamentStatus = getTournamentStatus(tournament.start_date, tournament.end_date)
                const startDate = new Date(tournament.start_date)
                const endDate = new Date(tournament.end_date)

                return (
                  <Card
                    key={tournament.id}
                    className="relative border-zinc-800/50 overflow-hidden hover:border-primary/50 transition-all duration-500 group p-0 cursor-pointer shadow-2xl min-h-[300px] md:min-h-[360px] flex flex-col justify-between"
                    onClick={() => handleTournamentClick(tournament)}
                  >
                    {/* Full Card Background Image */}
                    <div
                      className="absolute inset-0 bg-cover bg-center pointer-events-none transition-transform duration-1000 group-hover:scale-105"
                      style={{
                        backgroundImage: 'url(/leet_lol_header.jpg)',
                        filter: 'brightness(0.7) contrast(1.15) saturate(1.1)'
                      }}
                    />

                    {/* Gradient Overlay for Text Legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70 pointer-events-none" />

                    {/* Tournament Header Content */}
                    <div className="relative p-6 md:p-8 z-10 pointer-events-none w-full">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-2xl md:text-4xl font-black text-white group-hover:text-primary transition-colors tracking-tight line-clamp-2 drop-shadow-2xl max-w-[70%] md:max-w-[80%] leading-tight">
                          {tournament.name}
                        </h3>
                        <div className="flex-shrink-0">
                          {tournamentStatus.status === 'upcoming' && (
                            <span className="px-4 py-1.5 rounded-full font-bold text-xs bg-orange-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                              Upcoming
                            </span>
                          )}
                          {tournamentStatus.status === 'in-progress' && (
                            <span className="px-4 py-1.5 rounded-full font-bold text-xs bg-green-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.4)] flex items-center gap-2 animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              Live
                            </span>
                          )}
                          {tournamentStatus.status === 'completed' && (
                            <span className="px-4 py-1.5 rounded-full font-bold text-xs bg-zinc-700 text-zinc-200 uppercase tracking-widest shadow-md">
                              Finished
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Stats & Actions */}
                    <div className="relative p-6 md:p-8 z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6 pointer-events-none mt-auto">
                      {/* Stats Unified Bar */}
                      <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-1 flex items-center gap-1 flex-wrap sm:flex-nowrap shadow-2xl pointer-events-auto">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                          <div className="p-2.5 bg-orange-500/20 rounded-xl shadow-inner">
                            <Calendar className="h-5 w-5 text-orange-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mb-0.5">Start</span>
                            <span className="text-sm font-bold text-white whitespace-nowrap">
                              {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="hidden sm:block w-px h-10 bg-white/10 mx-1" />

                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                          <div className="p-2.5 bg-yellow-500/20 rounded-xl shadow-inner">
                            <Trophy className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mb-0.5">Prize</span>
                            <span className="text-sm font-bold text-white whitespace-nowrap">{tournament.prize_pool || 'TBD'}</span>
                          </div>
                        </div>

                        <div className="hidden sm:block w-px h-10 bg-white/10 mx-1" />

                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                          <div className="p-2.5 bg-blue-500/20 rounded-xl shadow-inner">
                            <Users className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest mb-0.5">Entry</span>
                            <span className="text-sm font-bold text-white whitespace-nowrap">
                              {participantCount} <span className="text-zinc-500">/ {tournament.max_teams}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Registration Action */}
                      <div className="pointer-events-auto shrink-0 w-full xl:w-auto">
                        {user && userTeam ? (
                          registrationStatuses[tournament.id] === 'approved' ? (
                            <div className="w-full xl:w-auto py-4 px-8 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest">
                              <CheckCircle className="h-5 w-5" /> REGISTERED
                            </div>
                          ) : registrationStatuses[tournament.id] === 'pending' ? (
                            <div className="w-full xl:w-auto py-4 px-8 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest">
                              <Clock className="h-5 w-5" /> PENDING APPROVAL
                            </div>
                          ) : registrationStatuses[tournament.id] === 'rejected' ? (
                            <div className="w-full xl:w-auto py-4 px-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 font-black text-sm text-center flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest">
                              <XCircle className="h-5 w-5" /> DECLINED
                            </div>
                          ) : tournamentStatus.status === 'upcoming' ? (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRegister(tournament.id)
                              }}
                              disabled={registering === tournament.id}
                              className="w-full xl:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-black text-sm px-10 py-7 rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all duration-300 hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest"
                            >
                              {registering === tournament.id ? 'REGISTERING...' : 'REGISTER NOW'}
                            </Button>
                          ) : (
                            <div className="w-full xl:w-auto py-4 px-8 rounded-2xl bg-zinc-800/80 border border-white/5 text-zinc-400 font-black text-sm text-center shadow-lg uppercase tracking-widest">
                              CLOSED
                            </div>
                          )
                        ) : user ? (
                          <div className="w-full xl:w-auto py-4 px-8 rounded-2xl bg-zinc-900/80 backdrop-blur border border-white/10 text-zinc-400 font-black text-sm text-center shadow-lg uppercase tracking-widest">
                            JOIN A TEAM TO PLAY
                          </div>
                        ) : (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push('/auth')
                            }}
                            className="w-full xl:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-black text-sm px-10 py-7 rounded-2xl shadow-xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest"
                          >
                            LOGIN TO REGISTER
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
