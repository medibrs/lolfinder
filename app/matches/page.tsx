'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { getCompactMatchRouteId, getMatchPath } from '@/lib/slugs'

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
  details?: Array<{
    game_number: number
    game_data?: any
    game_duration?: number | null
  }>
}

type FeedFilter = 'live' | 'upcoming' | 'results'

interface ExpandedStats {
  team1Champions: string[]
  team2Champions: string[]
  team1Kills: number | null
  team2Kills: number | null
  team1Gold: number | null
  team2Gold: number | null
}

const DDRAGON_VERSION = '15.23.1'

function toDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
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

function championIcon(championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${championName}.png`
}

function parseChampionList(input: any): string[] {
  if (!Array.isArray(input)) return []

  return input
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        return item.championName || item.champion || item.name || null
      }
      return null
    })
    .filter(Boolean)
    .slice(0, 5)
}

function numberOrNull(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function extractStats(match: MatchRow): ExpandedStats {
  const fallback: ExpandedStats = {
    team1Champions: [],
    team2Champions: [],
    team1Kills: null,
    team2Kills: null,
    team1Gold: null,
    team2Gold: null,
  }

  const sample = match.details?.[0]?.game_data
  if (!sample || typeof sample !== 'object') {
    return fallback
  }

  const team1Data = sample.team1 || sample.blue || sample.blueTeam || sample.left || {}
  const team2Data = sample.team2 || sample.red || sample.redTeam || sample.right || {}

  const team1Champions = parseChampionList(
    team1Data.champions || team1Data.picks || sample.team1Champions || sample.blueChampions
  )
  const team2Champions = parseChampionList(
    team2Data.champions || team2Data.picks || sample.team2Champions || sample.redChampions
  )

  return {
    team1Champions,
    team2Champions,
    team1Kills: numberOrNull(team1Data.kills ?? sample.team1Kills),
    team2Kills: numberOrNull(team2Data.kills ?? sample.team2Kills),
    team1Gold: numberOrNull(team1Data.gold ?? sample.team1Gold),
    team2Gold: numberOrNull(team2Data.gold ?? sample.team2Gold),
  }
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FeedFilter>('live')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/matches?limit=200')
        if (!response.ok) {
          setMatches([])
          return
        }

        const payload = await response.json()
        setMatches(payload.matches || [])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const liveMatches = useMemo(
    () => matches.filter((match) => match.status === 'In_Progress'),
    [matches]
  )

  const upcomingMatches = useMemo(
    () => matches.filter((match) => match.status === 'Scheduled'),
    [matches]
  )

  const resultMatches = useMemo(
    () => matches.filter((match) => match.status === 'Completed'),
    [matches]
  )

  const featuredMatch = useMemo(() => {
    if (liveMatches.length > 0) return liveMatches[0]
    if (resultMatches.length > 0) return resultMatches[0]
    return upcomingMatches[0] || null
  }, [liveMatches, resultMatches, upcomingMatches])

  const feed = useMemo(() => {
    if (filter === 'live') return liveMatches
    if (filter === 'upcoming') return upcomingMatches
    return resultMatches
  }, [filter, liveMatches, upcomingMatches, resultMatches])

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background text-white">
      <div className="max-w-7xl mx-auto px-4 space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1221]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url(${featuredMatch?.tournament?.banner_image || '/leet_lol_header.jpg'})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />

          <div className="relative p-6 md:p-10">
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-4">Match Center</div>

            {!featuredMatch ? (
              <div className="text-slate-300">No featured match available.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-2">
                  <div className="flex items-center justify-end gap-4">
                    <div className="text-right">
                      <p className="text-2xl md:text-4xl font-black uppercase tracking-wide">
                        {featuredMatch.team1?.name || 'TBD'}
                      </p>
                    </div>
                    <img
                      src={getTeamAvatarUrl(featuredMatch.team1?.team_avatar) || '/favicon.ico'}
                      alt={featuredMatch.team1?.name || 'Team 1'}
                      className="w-16 h-16 md:w-24 md:h-24 rounded-2xl border border-blue-500/40 object-cover"
                    />
                  </div>

                  <div className="text-center">
                    {featuredMatch.status === 'In_Progress' && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-widest mb-3">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> LIVE
                      </div>
                    )}

                    <div className="text-3xl md:text-5xl font-black">
                      {(featuredMatch.team1_score ?? 0)} - {(featuredMatch.team2_score ?? 0)}
                    </div>
                    <div className="text-slate-400 text-xs md:text-sm uppercase tracking-widest mt-2">
                      BO{featuredMatch.best_of || 1} • {getStageLabel(featuredMatch)}
                    </div>
                  </div>

                  <div className="flex items-center justify-start gap-4">
                    <img
                      src={getTeamAvatarUrl(featuredMatch.team2?.team_avatar) || '/favicon.ico'}
                      alt={featuredMatch.team2?.name || 'Team 2'}
                      className="w-16 h-16 md:w-24 md:h-24 rounded-2xl border border-red-500/40 object-cover"
                    />
                    <div>
                      <p className="text-2xl md:text-4xl font-black uppercase tracking-wide">
                        {featuredMatch.team2?.name || 'TBD'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  {featuredMatch.stream_url ? (
                    <a
                      href={featuredMatch.stream_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-7 py-2.5 rounded-lg bg-[#c9aa71] text-black text-xs font-black uppercase tracking-[0.2em] hover:brightness-110 transition"
                    >
                      Watch Stream
                    </a>
                  ) : (
                    <Link
                      href={getMatchPath({
                        id: getCompactMatchRouteId(featuredMatch.id),
                        team1Name: featuredMatch.team1?.name,
                        team2Name: featuredMatch.team2?.name,
                        contextName: featuredMatch.tournament?.name,
                      })}
                      className="px-7 py-2.5 rounded-lg bg-[#c9aa71] text-black text-xs font-black uppercase tracking-[0.2em] hover:brightness-110 transition"
                    >
                      Match Details
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            {(['live', 'upcoming', 'results'] as FeedFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest border transition ${
                  filter === item
                    ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loading && <div className="text-slate-400 text-sm">Loading matches…</div>}

          {!loading && feed.length === 0 && (
            <div className="text-slate-500 text-sm">No matches in this category yet.</div>
          )}

          {!loading && feed.map((match) => {
            const isComplete = match.status === 'Completed'
            const isLive = match.status === 'In_Progress'
            const matchPath = getMatchPath({
              id: getCompactMatchRouteId(match.id),
              team1Name: match.team1?.name,
              team2Name: match.team2?.name,
              contextName: match.tournament?.name,
            })

            const stats = extractStats(match)

            return (
              <div key={match.id} className="space-y-2">
                <button
                  onClick={() => setExpanded(expanded === match.id ? null : match.id)}
                  className="w-full text-left flex flex-col md:flex-row items-center justify-between bg-[#0b1221] border border-slate-800 hover:border-slate-600 rounded-lg p-4 transition-colors group"
                >
                  <div className="flex flex-col w-full md:w-1/4 mb-4 md:mb-0 border-b md:border-b-0 md:border-r border-slate-800/50 pb-4 md:pb-0 pr-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {match.tournament?.name || 'Tournament'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      {getStageLabel(match)} • BO{match.best_of || 1}
                    </span>
                    <span className="text-sm font-medium text-slate-300 mt-2 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        isLive
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                          : isComplete
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                            : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      }`} />
                      {isLive ? 'Live' : isComplete ? 'Finished' : formatWhen(match)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center w-full md:w-1/2 gap-6 md:gap-12">
                    <div className="flex items-center gap-3 text-right">
                      <span className="hidden sm:block font-bold text-white text-lg">{match.team1?.name || 'TBD'}</span>
                      <img
                        src={getTeamAvatarUrl(match.team1?.team_avatar) || '/favicon.ico'}
                        className="w-10 h-10 rounded-full border border-blue-500/30 object-cover"
                        alt={match.team1?.name || 'Team 1'}
                      />
                    </div>

                    <div className="flex items-center justify-center bg-slate-900 border border-slate-700 rounded px-4 py-2 shadow-inner min-w-[72px]">
                      <span className="text-xl font-bold text-white">{match.team1_score ?? 0}</span>
                      <span className="mx-2 text-slate-500 text-sm">:</span>
                      <span className="text-xl font-bold text-slate-300">{match.team2_score ?? 0}</span>
                    </div>

                    <div className="flex items-center gap-3 text-left">
                      <img
                        src={getTeamAvatarUrl(match.team2?.team_avatar) || '/favicon.ico'}
                        className="w-10 h-10 rounded-full border border-red-500/30 object-cover"
                        alt={match.team2?.name || 'Team 2'}
                      />
                      <span className="hidden sm:block font-bold text-white text-lg">{match.team2?.name || 'TBD'}</span>
                    </div>
                  </div>

                  <div className="w-full md:w-1/4 flex justify-end mt-4 md:mt-0 pl-4">
                    <Link
                      href={matchPath}
                      onClick={(event) => event.stopPropagation()}
                      className={`px-5 py-2 border text-xs font-bold uppercase tracking-widest rounded transition-colors ${
                        isComplete
                          ? 'border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400'
                          : 'border-slate-700 text-slate-300 hover:border-[#c9aa71] hover:text-[#c9aa71]'
                      }`}
                    >
                      {isComplete ? 'View Stats' : 'Set Reminder'}
                    </Link>
                  </div>
                </button>

                {isComplete && expanded === match.id && (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="flex justify-center gap-1">
                        {stats.team1Champions.length > 0 ? stats.team1Champions.map((champ) => (
                          <img
                            key={`a-${match.id}-${champ}`}
                            src={championIcon(champ)}
                            alt={champ}
                            className="w-10 h-10 rounded-md border border-blue-500/30"
                          />
                        )) : Array.from({ length: 5 }).map((_, index) => (
                          <div key={`ap-${match.id}-${index}`} className="w-10 h-10 rounded-md border border-blue-500/20 bg-slate-800" />
                        ))}
                      </div>

                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Post Match</p>
                        <div className="flex items-center justify-center gap-3 text-sm">
                          <span className="text-blue-300">K {stats.team1Kills ?? '--'}</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-red-300">K {stats.team2Kills ?? '--'}</span>
                        </div>
                        <div className="flex items-center justify-center gap-3 text-xs mt-2">
                          <span className="text-blue-300">Gold {stats.team1Gold ?? '--'}</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-red-300">Gold {stats.team2Gold ?? '--'}</span>
                        </div>
                      </div>

                      <div className="flex justify-center gap-1">
                        {stats.team2Champions.length > 0 ? stats.team2Champions.map((champ) => (
                          <img
                            key={`b-${match.id}-${champ}`}
                            src={championIcon(champ)}
                            alt={champ}
                            className="w-10 h-10 rounded-md border border-red-500/30"
                          />
                        )) : Array.from({ length: 5 }).map((_, index) => (
                          <div key={`bp-${match.id}-${index}`} className="w-10 h-10 rounded-md border border-red-500/20 bg-slate-800" />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>

      </div>
    </main>
  )
}
