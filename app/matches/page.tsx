'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Calendar, Clock, MapPin, Tv, Shield, ChevronRight, ChevronDown, EyeOff } from 'lucide-react'
import { cdnUrl } from '@/lib/cdn'
import Link from 'next/link'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { getCompactMatchRouteId, getMatchPath } from '@/lib/slugs'
import { getCached, setCache } from '@/lib/cache'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */

type MatchStatus = 'Scheduled' | 'In_Progress' | 'Completed' | string

interface TeamLite {
  id: string
  name: string
  team_avatar?: number | string
}

interface MatchRow {
  id: string
  match_number?: number | null
  status: MatchStatus
  stream_url?: string | null
  match_room?: string | null
  notes?: string | null
  is_locked?: boolean | null
  override_reason?: string | null
  best_of?: number | null
  team1_score?: number | null
  team2_score?: number | null
  scheduled_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  team1?: TeamLite | null
  team2?: TeamLite | null
  tournament?: {
    id: string
    name: string
    format?: string | null
    banner_image?: string | null
  } | null
  bracket?: {
    round_number?: number | null
    is_final?: boolean | null
  } | null
}

interface TournamentOption {
  id: string
  name: string
  banner_image?: string | null
  start_date: string
  end_date: string
  format?: string | null
}

/* ── Helpers ── */

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatDateTime(value?: string | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatWhen(match: MatchRow): string {
  const source = match.started_at || match.scheduled_at || match.completed_at
  const date = toDate(source)
  if (!date) return 'TBD'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStageLabel(match: MatchRow): string {
  if (match.bracket?.is_final) return 'Grand Finals'
  const round = match.bracket?.round_number
  if (round && round > 0) return `Round ${round}`
  return 'Main Stage'
}

function getTournamentStatus(startDate: string, endDate: string): string {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (now < start) return 'upcoming'
  if (now >= start && now <= end) return 'live'
  return 'ended'
}

function getDayKey(match: MatchRow): string {
  const source = match.scheduled_at || match.started_at || match.completed_at
  const date = toDate(source)
  if (!date) return 'unscheduled'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDayHeader(dayKey: string): string {
  if (dayKey === 'unscheduled') return 'Unscheduled'
  const date = new Date(dayKey + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatMatchTime(match: MatchRow): string {
  const source = match.scheduled_at || match.started_at
  const date = toDate(source)
  if (!date) return 'TBD'
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function groupMatchesByDay(matches: MatchRow[]): { dayKey: string; matches: MatchRow[] }[] {
  const groups = new Map<string, MatchRow[]>()
  for (const match of matches) {
    const key = getDayKey(match)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(match)
  }
  // Sort day keys chronologically, 'unscheduled' last
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === 'unscheduled') return 1
    if (b === 'unscheduled') return -1
    return a.localeCompare(b)
  })
  return sortedKeys.map((dayKey) => ({ dayKey, matches: groups.get(dayKey)! }))
}

/* ── Page ── */

export default function MatchesPage() {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([])
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [revealedMatches, setRevealedMatches] = useState<Set<string>>(new Set())

  // Fetch active tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      const { data: cached, isFresh } = getCached<TournamentOption[]>('matches_tournaments')
      if (cached) {
        setTournaments(cached)
        setLoadingTournaments(false)
        if (cached.length > 0 && !selectedTournament) setSelectedTournament(cached[0].id)
        if (isFresh) return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('tournaments')
        .select('id, name, banner_image, start_date, end_date, format')
        .order('start_date', { ascending: false })

      if (data && data.length > 0) {
        setTournaments(data)
        setCache('matches_tournaments', data)
        if (!selectedTournament) setSelectedTournament(data[0].id)
      }
      setLoadingTournaments(false)
    }

    fetchTournaments()
  }, [])

  // Fetch matches when tournament changes
  useEffect(() => {
    if (!selectedTournament) return

    const fetchMatches = async () => {
      setLoadingMatches(true)
      const cacheKey = `matches_t_${selectedTournament}`
      const { data: cached, isFresh } = getCached<MatchRow[]>(cacheKey)
      if (cached) {
        setMatches(cached)
        setLoadingMatches(false)
        if (isFresh) return
      }

      try {
        const res = await fetch(`/api/matches?tournament_id=${selectedTournament}&limit=200`)
        if (res.ok) {
          const payload = await res.json()
          const freshMatches = payload.matches || []
          setMatches(freshMatches)
          setCache(cacheKey, freshMatches)
        } else if (!cached) {
          setMatches([])
        }
      } finally {
        setLoadingMatches(false)
      }
    }

    fetchMatches()
    setExpandedMatch(null)
  }, [selectedTournament])

  const activeTournament = tournaments.find((t) => t.id === selectedTournament)

  const statusCounts = useMemo(() => {
    const live = matches.filter((m) => m.status === 'In_Progress').length
    const upcoming = matches.filter((m) => m.status === 'Scheduled').length
    const completed = matches.filter((m) => m.status === 'Completed').length
    return { live, upcoming, completed, total: matches.length }
  }, [matches])

  const grouped = useMemo(() => groupMatchesByDay(matches), [matches])

  return (
    <main className="min-h-screen pt-24 pb-12 bg-[#010a13] text-white">
      <div className="fixed inset-0 bg-[#010a13] -z-20" />
      <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-cyan-900/10 via-transparent to-rose-900/10 blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 space-y-10">
        {/* Page Header */}
        <div className="relative pb-4">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-[#c9aa71]/50" />
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
              Match Center
            </h1>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#c9aa71]/50 to-[#c9aa71]/50" />
          </div>
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Select a tournament to browse its matches
          </p>
        </div>

        {/* Tournament Selector */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={16} className="text-[#c9aa71]" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Tournaments</h2>
          </div>

          {loadingTournaments ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No active tournaments found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tournaments.map((t) => {
                const isSelected = t.id === selectedTournament
                const status = getTournamentStatus(t.start_date, t.end_date)
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTournament(t.id)}
                    className={`relative group text-left rounded-lg overflow-hidden border transition-all duration-200 ${
                      isSelected
                        ? 'border-[#c9aa71]/60 shadow-[0_0_20px_rgba(201,170,113,0.15)]'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity" style={{ backgroundImage: `url(${t.banner_image || cdnUrl('/leet_lol_header.jpg')})` }} />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0c121d]/95 to-[#0c121d]/80" />
                    <div className="relative p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${isSelected ? 'bg-[#c9aa71]/20 border-[#c9aa71]/40' : 'bg-slate-800/60 border-slate-700'}`}>
                        <Trophy size={18} className={isSelected ? 'text-[#c9aa71]' : 'text-slate-500'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-[#c9aa71]' : 'text-slate-200'}`}>{t.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                            status === 'live' ? 'text-red-400' : status === 'upcoming' ? 'text-amber-400' : 'text-slate-500'
                          }`}>
                            {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                            {status}
                          </span>
                          {t.format && (
                            <>
                              <span className="text-slate-700">•</span>
                              <span className="text-[10px] text-slate-500 uppercase">{t.format.replace(/_/g, ' ')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {isSelected && <ChevronRight size={16} className="text-[#c9aa71] shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Match List */}
        {selectedTournament && (
          <section className="space-y-4">
            {/* Section header with stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-cyan-400" />
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  {activeTournament?.name || 'Tournament'} — Matches
                </h2>
              </div>
              {!loadingMatches && matches.length > 0 && (
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
                  {statusCounts.live > 0 && (
                    <span className="flex items-center gap-1.5 text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                      {statusCounts.live} Live
                    </span>
                  )}
                  <span className="text-amber-400">{statusCounts.upcoming} Upcoming</span>
                  <span className="text-emerald-400">{statusCounts.completed} Completed</span>
                </div>
              )}
            </div>

            {loadingMatches ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-slate-800/30 border border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-16 bg-[#0c121d]/40 border border-slate-800 rounded-lg">
                <Shield size={40} className="mx-auto text-slate-700 mb-4" />
                <p className="text-slate-500 text-sm">No matches found for this tournament.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {grouped.map(({ dayKey, matches: dayMatches }) => (
                  <div key={dayKey}>
                    {/* Day Header — bold underlined like reference */}
                    <div className="mb-5">
                      <h3 className="text-base md:text-lg font-black text-white underline underline-offset-4 decoration-2">
                        {formatDayHeader(dayKey)}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {dayMatches.map((match) => {
                        const isComplete = match.status === 'Completed'
                        const isLive = match.status === 'In_Progress'
                        const isExpanded = expandedMatch === match.id
                        const matchPath = getMatchPath({
                          id: getCompactMatchRouteId(match.id),
                          team1Name: match.team1?.name,
                          team2Name: match.team2?.name,
                          contextName: match.tournament?.name,
                        })

                        const isSpoilerHidden = isComplete && !revealedMatches.has(match.id)

                        const handleCardClick = () => {
                          if (isSpoilerHidden) {
                            setRevealedMatches(prev => new Set(prev).add(match.id))
                            return
                          }
                          setExpandedMatch(isExpanded ? null : match.id)
                        }

                        return (
                          <div key={match.id}>
                            {/* Match Card */}
                            <button
                              onClick={handleCardClick}
                              className={`w-full text-left border transition-all ${
                                isExpanded
                                  ? 'border-[#c9aa71]/40 rounded-t-lg'
                                  : 'border-slate-700/50 rounded-lg hover:border-slate-600'
                              } bg-[#111318] overflow-hidden`}
                            >
                              {/* Top row: Time + Teams + Score */}
                              <div className="relative">
                                {/* Anti-spoiler overlay for completed matches */}
                                {isSpoilerHidden && (
                                  <div className="flex items-center justify-center px-4 py-6 md:py-7 gap-3 cursor-pointer select-none">
                                    <EyeOff size={20} className="text-slate-400" />
                                    <span className="text-sm font-bold uppercase tracking-[0.15em] text-slate-400">
                                      Click to reveal
                                    </span>
                                  </div>
                                )}

                                {/* Actual match content — hidden when spoiler is active */}
                                {!isSpoilerHidden && (
                                  <div className="flex items-center px-4 py-4 md:py-5 gap-4 md:gap-6">
                                    {/* Time or Play icon for completed */}
                                    {isComplete ? (
                                      <div className="w-[70px] shrink-0 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded bg-slate-700/60 flex items-center justify-center">
                                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 5v14l11-7z" />
                                          </svg>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-2xl md:text-3xl font-black text-white tabular-nums shrink-0 min-w-[70px]">
                                        {formatMatchTime(match)}
                                      </div>
                                    )}

                                    {/* Teams + Score */}
                                    <div className="flex items-center justify-center flex-1 gap-3 md:gap-5">
                                      <span className="font-bold text-white text-sm md:text-base truncate text-right flex-1">
                                        {match.team1?.name || 'TBD'}
                                      </span>
                                      <img
                                        src={getTeamAvatarUrl(match.team1?.team_avatar) || '/favicon.ico'}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-600 object-cover shrink-0"
                                        alt={match.team1?.name || 'Team 1'}
                                      />

                                      {/* Score for completed, slash for others */}
                                      {isComplete ? (
                                        <div className="flex items-center gap-2 tabular-nums">
                                          <span className="text-xl md:text-2xl font-black text-white">{match.team1_score ?? 0}</span>
                                          <span className="text-slate-500 text-lg font-light">/</span>
                                          <span className="text-xl md:text-2xl font-black text-white">{match.team2_score ?? 0}</span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 text-lg font-light">/</span>
                                      )}

                                      <img
                                        src={getTeamAvatarUrl(match.team2?.team_avatar) || '/favicon.ico'}
                                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-600 object-cover shrink-0"
                                        alt={match.team2?.name || 'Team 2'}
                                      />
                                      <span className="font-bold text-white text-sm md:text-base truncate flex-1">
                                        {match.team2?.name || 'TBD'}
                                      </span>
                                    </div>

                                    {/* Expand chevron */}
                                    <ChevronDown size={16} className={`text-slate-500 transition-transform shrink-0 ${
                                      isExpanded ? 'rotate-180 text-[#c9aa71]' : ''
                                    }`} />
                                  </div>
                                )}
                              </div>

                              {/* Bottom info bar */}
                              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/30 bg-[#0d0f13]">
                                <div className="flex items-center gap-2">
                                  {isLive && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                  )}
                                  <span className="text-xs text-slate-400">
                                    {match.tournament?.name || 'Tournament'} • {getStageLabel(match)}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 font-medium">Bo{match.best_of || 1}</span>
                              </div>
                            </button>

                      {/* Expanded: Match Details */}
                      {isExpanded && (
                        <div className="bg-[#0c121d]/80 border border-t-0 border-[#c9aa71]/40 rounded-b-lg p-5 space-y-5">
                          {/* Scheduling */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-[#c9aa71]" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Scheduling</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Scheduled Time</p>
                                <p className="text-sm text-slate-200 font-medium">{formatDateTime(match.scheduled_at)}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Started At</p>
                                <p className="text-sm text-slate-200 font-medium">{formatDateTime(match.started_at)}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Completed At</p>
                                <p className="text-sm text-slate-200 font-medium">{formatDateTime(match.completed_at)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Location & Media */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <MapPin size={14} className="text-[#c9aa71]" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Location & Media</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Match Room / Lobby Info</p>
                                <p className="text-sm text-slate-200 font-medium">{match.match_room || '—'}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Stream URL</p>
                                {match.stream_url ? (
                                  <a href={match.stream_url} target="_blank" rel="noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium truncate block">
                                    {match.stream_url}
                                  </a>
                                ) : (
                                  <p className="text-sm text-slate-200 font-medium">—</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Rules & Admin */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Shield size={14} className="text-[#c9aa71]" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Rules & Admin</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Best Of (Series)</p>
                                <p className="text-sm text-slate-200 font-bold">BO{match.best_of || 1}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Match Locked</p>
                                <p className={`text-sm font-bold ${match.is_locked ? 'text-red-400' : 'text-slate-400'}`}>
                                  {match.is_locked ? 'Locked' : 'Open'}
                                </p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Override Reason</p>
                                <p className="text-sm text-slate-200 font-medium">{match.override_reason || '—'}</p>
                              </div>
                            </div>
                            {match.notes && (
                              <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Admin Notes</p>
                                <p className="text-sm text-slate-300 italic">{match.notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Link to full match page */}
                          <div className="flex justify-end pt-2">
                            <Link
                              href={matchPath}
                              className="px-6 py-2.5 bg-[#c9aa71] hover:bg-[#b89961] text-zinc-900 font-beaufort font-black text-xs uppercase tracking-[0.2em] rounded-sm transition-all active:translate-y-[1px]"
                            >
                              Full Match Page
                            </Link>
                          </div>
                        </div>
                      )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
