import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import Image from 'next/image'
import { getTournamentPath } from '@/lib/slugs'
import { getRankImage } from '@/lib/rank-utils'
import RoleIcon from '@/components/RoleIcon'
import { Trophy, Clock, Share2, ExternalLink, Calendar, ChevronRight, Zap, Target, Shield, Info, InfoIcon, Users } from 'lucide-react'
import { cdnUrl } from '@/lib/cdn';
import { cn } from '@/lib/utils'

import { DDRAGON_VERSION } from '@/lib/ddragon'

type Props = {
  params: Promise<{
    id: string
    slug: string
  }>
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getTeamAvatarUrl(avatarId?: number | string | null): string | null {
  if (!avatarId) return null
  if (typeof avatarId === 'string' && avatarId.startsWith('http')) return avatarId
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${avatarId}.png`
}

function getStatValue(wins = 0, losses = 0) {
  const total = wins + losses
  if (total === 0) return '0%'
  return `${Math.round((wins / total) * 100)}%`
}

// Lineup Player Card Component
function LineupPlayerCard({ player, color }: { player: any, color: 'blue' | 'red' }) {
  const borderColor = color === 'blue' ? 'border-cyan-500/30' : 'border-rose-500/30'
  const glowShadow = color === 'blue' ? 'shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'shadow-[0_0_15px_rgba(244,63,94,0.1)]'

  return (
    <div className={cn(
      "relative group flex flex-col bg-[#060a13] border overflow-hidden transition-all duration-300 hover:-translate-y-1",
      borderColor,
      glowShadow,
      "rounded-sm"
    )}>
      {/* Player Image Placeholder (League UI Style) */}
      <div className="relative aspect-[3/4] bg-[#0c121d] overflow-hidden">
        {player.profile_icon_id ? (
          <Image
            src={getTeamAvatarUrl(player.profile_icon_id) || ''}
            alt={player.summoner_name}
            fill
            className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Shield className="w-12 h-12 text-slate-800" />
          </div>
        )}

        {/* Bottom Banner with Name */}
        <div className={cn(
          "absolute bottom-0 inset-x-0 h-10 bg-[#0c121d]/90 backdrop-blur-md border-t flex items-center justify-between px-3",
          borderColor
        )}>
          <div className="flex items-center gap-2 max-w-[70%]">
            <Image src={getRankImage(player.tier)} alt="" width={16} height={16} className="object-contain" />
            <span className="text-[11px] font-beaufort font-bold text-slate-200 truncate uppercase tracking-wider">
              {player.summoner_name.split('#')[0]}
            </span>
          </div>
          <div className="opacity-60 scale-75">
            <RoleIcon role={player.main_role} />
          </div>
        </div>
      </div>
    </div>
  )
}

async function getMatch(id: string, slug?: string) {
  const selectQuery = `
      id,
      tournament_id,
      bracket_id,
      status,
      result,
      match_number,
      best_of,
      team1_score,
      team2_score,
      scheduled_at,
      started_at,
      completed_at,
      stream_url,
      match_room,
      notes,
      is_locked,
      override_reason,
      team1_id,
      team2_id,
      winner:teams!tournament_matches_winner_id_fkey(id, name),
      tournament:tournaments(id, name, tournament_number, format, banner_image),
      team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
      team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar)
    `

  const isNumericRoute = /^\d+$/.test(id)
  let match: any = null

  if (isNumericRoute) {
    const matchNumber = parseInt(id, 10)
    const { data: candidates } = await supabase
      .from('tournament_matches')
      .select(selectQuery)
      .eq('match_number', matchNumber)
      .order('created_at', { ascending: false })

    if (candidates && candidates.length > 0) {
      if (slug && candidates.length > 1) {
        const slugMatch = candidates.find((candidate: any) => {
          const composed = `${candidate.team1?.name || 'team-1'} vs ${candidate.team2?.name || 'team-2'} ${candidate.tournament?.name || 'match'}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
          return composed === slug
        })
        match = slugMatch || candidates[0]
      } else {
        match = candidates[0]
      }
    } else {
      const { data: byPrefix } = await supabase
        .from('tournament_matches')
        .select(selectQuery)
        .ilike('id', `${id}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      if (slug && byPrefix && byPrefix.length > 1) {
        const slugMatch = byPrefix.find((candidate: any) => {
          const composed = `${candidate.team1?.name || 'team-1'} vs ${candidate.team2?.name || 'team-2'} ${candidate.tournament?.name || 'match'}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
          return composed === slug
        })
        match = slugMatch || byPrefix[0] || null
      } else {
        match = byPrefix?.[0] || null
      }
    }
  } else {
    const { data: exact } = await supabase
      .from('tournament_matches')
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle()

    if (exact) {
      match = exact
    } else {
      const { data: candidates } = await supabase
        .from('tournament_matches')
        .select(selectQuery)
        .ilike('id', `${id}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      match = candidates?.[0] || null
    }
  }

  if (!match) return null

  const [{ data: bracket }, { data: details }, { data: games }, { data: team1Players }, { data: team2Players }] = await Promise.all([
    match.bracket_id
      ? supabase
        .from('tournament_brackets')
        .select('id, round_number, is_final, bracket_position')
        .eq('id', match.bracket_id)
        .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('tournament_match_details')
      .select('id, game_number, game_duration, game_data')
      .eq('match_id', match.id)
      .order('game_number', { ascending: true }),
    supabase
      .from('tournament_match_games')
      .select('id, game_number, duration, winner_id, game_data')
      .eq('match_id', match.id)
      .order('game_number', { ascending: true }),
    match.team1_id
      ? supabase
        .from('players')
        .select('id, summoner_name, main_role, tier, rank, profile_icon_id')
        .eq('team_id', match.team1_id)
      : Promise.resolve({ data: [] }),
    match.team2_id
      ? supabase
        .from('players')
        .select('id, summoner_name, main_role, tier, rank, profile_icon_id')
        .eq('team_id', match.team2_id)
      : Promise.resolve({ data: [] }),
  ])

  return {
    ...match,
    team1: match.team1 ? { ...match.team1, players: team1Players || [] } : match.team1,
    team2: match.team2 ? { ...match.team2, players: team2Players || [] } : match.team2,
    bracket: bracket || null,
    details: details || [],
    games: games || [],
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, slug } = await params
  const match = await getMatch(id, slug)

  if (!match) {
    return {
      title: 'Match Not Found',
      description: 'The requested match could not be found.',
    }
  }

  const team1Name = match.team1?.name || 'Team 1'
  const team2Name = match.team2?.name || 'Team 2'
  const tournamentName = match.tournament?.name || slug.replace(/-/g, ' ')

  return {
    title: `${team1Name} vs ${team2Name} | ${tournamentName}`,
    description: `Match page for ${team1Name} vs ${team2Name} in ${tournamentName}.`,
  }
}

export default async function MatchPage({ params }: Props) {
  const { id, slug } = await params
  const match = await getMatch(id, slug)

  if (!id || !slug || !match) {
    notFound()
  }

  const stage = match.bracket?.is_final
    ? 'Grand Finals'
    : `Round ${match.bracket?.round_number || 1}`

  const matchTime = new Date(match.started_at || match.scheduled_at || match.completed_at || Date.now())

  // Separate lineups
  const team1Lineup = (match.team1?.players || []).slice(0, 5)
  const team2Lineup = (match.team2?.players || []).slice(0, 5)

  return (
    <main className="min-h-screen pt-24 pb-12 bg-[#010a13] text-white">
      {/* Cinematic Background Blur */}
      <div className="fixed inset-0 bg-[#010a13] -z-20"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-cyan-900/10 via-transparent to-rose-900/10 blur-[120px] -z-10 pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 space-y-12">
        {/* Match Header (Leaderboard Theme) */}
        <div className="relative pb-6">
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-[#c9aa71]/50"></div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
              Match Details
            </h1>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#c9aa71]/50 to-[#c9aa71]/50"></div>
          </div>
          <div className="flex items-center justify-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">Battle of the Rift</span>
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
          </div>
        </div>

        {/* Hero Scoreboard Section */}
        <section className="relative group overflow-hidden bg-[#0c121d]/80 border border-slate-700/40 backdrop-blur-xl shadow-2xl rounded-sm">
          {/* Animated Glow Border Piece */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"></div>

          {/* Background Banner Elements */}
          <div className="absolute inset-0 bg-cover bg-center opacity-[0.05] pointer-events-none" style={{ backgroundImage: `url(${match.tournament?.banner_image || cdnUrl('/leet_lol_header.jpg')})` }} />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c121d] via-[#0c121d]/80 to-transparent"></div>

          <div className="relative p-6 md:p-10">
            {/* Top Bar - Tournament info */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                  <Trophy size={18} className="text-[#c9aa71]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c9aa71] opacity-70">
                    {match.tournament?.name || 'Tournament'}
                  </p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    {stage} • BO{match.best_of || 1}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10">
                <div className={cn("w-1.5 h-1.5 rounded-full", match.status === 'In_Progress' ? 'bg-red-500 animate-pulse' : 'bg-slate-500')} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {match.status === 'In_Progress' ? 'Live' : match.status === 'Completed' ? 'Final' : 'Scheduled'}
                </span>
                <span className="text-white/10 ml-1">|</span>
                <span className="text-[10px] text-slate-500 font-bold ml-1">
                  {matchTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Scoreboard GRID */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center">
              {/* Team 1 Blue */}
              <div className="md:col-span-3 flex flex-col md:flex-row items-center gap-6 group/blue">
                <div className="relative order-2 md:order-1 flex-1 text-center md:text-right">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white/90 group-hover/blue:text-cyan-400 transition-colors drop-shadow-lg">
                    {match.team1?.name || 'TBD'}
                  </h2>
                  <p className="text-[10px] text-cyan-400/60 font-black uppercase tracking-[0.2em] mt-1">Blue Side</p>
                </div>
                <div className="relative order-1 md:order-2 w-20 h-20 md:w-24 md:h-24">
                  <div className="absolute inset-[-4px] rounded-lg bg-cyan-500/20 blur-[8px] opacity-0 group-hover/blue:opacity-100 transition-opacity"></div>
                  <div className="relative w-full h-full p-1 bg-[#060a13] border border-cyan-500/40 rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={getTeamAvatarUrl(match.team1?.team_avatar) || '/favicon.ico'}
                      alt={match.team1?.name || 'Team 1'}
                      className="w-full h-full object-cover transition-transform group-hover/blue:scale-110"
                    />
                  </div>
                </div>
              </div>

              {/* Score Center */}
              <div className="md:col-span-1 flex flex-col items-center justify-center">
                <div className="relative pb-2 px-8">
                  <div className="text-5xl md:text-6xl font-black font-beaufort flex items-center gap-4">
                    <span className={cn(match.team1_score > match.team2_score && match.status === 'Completed' ? "text-cyan-400" : "text-white/90")}>
                      {match.team1_score ?? 0}
                    </span>
                    <span className="text-white/10 text-3xl">vs</span>
                    <span className={cn(match.team2_score > match.team1_score && match.status === 'Completed' ? "text-rose-400" : "text-white/90")}>
                      {match.team2_score ?? 0}
                    </span>
                  </div>
                  {/* Decorative underline */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[1px] bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
                </div>
              </div>

              {/* Team 2 Red */}
              <div className="md:col-span-3 flex flex-col md:flex-row items-center gap-6 group/red">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <div className="absolute inset-[-4px] rounded-lg bg-rose-500/20 blur-[8px] opacity-0 group-hover/red:opacity-100 transition-opacity"></div>
                  <div className="relative w-full h-full p-1 bg-[#060a13] border border-rose-500/40 rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={getTeamAvatarUrl(match.team2?.team_avatar) || '/favicon.ico'}
                      alt={match.team2?.name || 'Team 2'}
                      className="w-full h-full object-cover transition-transform group-hover/red:scale-110"
                    />
                  </div>
                </div>
                <div className="relative flex-1 text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white/90 group-hover/red:text-rose-400 transition-colors drop-shadow-lg">
                    {match.team2?.name || 'TBD'}
                  </h2>
                  <p className="text-[10px] text-rose-400/60 font-black uppercase tracking-[0.2em] mt-1">Red Side</p>
                </div>
              </div>
            </div>

            {/* Quick Actions (League Styled Buttons) */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              {match.stream_url && (
                <a
                  href={match.stream_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-3 bg-[#c9aa71] hover:bg-[#b89961] text-zinc-900 font-beaufort font-black text-xs uppercase tracking-[0.2em] relative group active:translate-y-[1px] rounded-sm"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Zap size={14} className="fill-zinc-900" />
                    Watch Broadcast
                  </span>
                  <div className="absolute inset-0 border border-white/20 shadow-[inset_0_0_15px_rgba(255,255,255,0.3)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </a>
              )}
              {match.tournament && (
                <Link
                  href={getTournamentPath(match.tournament.tournament_number || match.tournament.id, match.tournament.name)}
                  className="px-8 py-3 border border-slate-700 bg-slate-900/40 hover:bg-slate-800 text-slate-300 font-beaufort font-black text-xs uppercase tracking-[0.2em] rounded-sm transition-all hover:border-[#c9aa71]/50 hover:text-[#c9aa71]"
                >
                  <span className="flex items-center gap-2">
                    <Shield size={14} />
                    Tournament Center
                  </span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Match Information (Scheduling / Location / Rules) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scheduling */}
          <div className="space-y-4 bg-[#0c121d]/60 border border-slate-800 rounded-sm p-5">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Calendar size={14} className="text-[#c9aa71]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Scheduling</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Scheduled Time</p>
                <p className="text-sm text-slate-200 font-medium">
                  {match.scheduled_at
                    ? new Date(match.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Started At</p>
                <p className="text-sm text-slate-200 font-medium">
                  {match.started_at
                    ? new Date(match.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Completed At</p>
                <p className="text-sm text-slate-200 font-medium">
                  {match.completed_at
                    ? new Date(match.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Location & Media */}
          <div className="space-y-4 bg-[#0c121d]/60 border border-slate-800 rounded-sm p-5">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <ExternalLink size={14} className="text-[#c9aa71]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Location & Media</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Match Room / Lobby</p>
                <p className="text-sm text-slate-200 font-medium">{match.match_room || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Stream URL</p>
                {match.stream_url ? (
                  <a href={match.stream_url} target="_blank" rel="noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300 font-medium break-all">
                    {match.stream_url}
                  </a>
                ) : (
                  <p className="text-sm text-slate-200 font-medium">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Rules & Admin */}
          <div className="space-y-4 bg-[#0c121d]/60 border border-slate-800 rounded-sm p-5">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Shield size={14} className="text-[#c9aa71]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9aa71]">Rules & Admin</span>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Best Of (Series)</p>
                <p className="text-sm text-slate-200 font-bold">BO{match.best_of || 1}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Match Locked</p>
                <p className={cn("text-sm font-bold", match.is_locked ? "text-red-400" : "text-slate-400")}>
                  {match.is_locked ? 'Locked — players cannot report scores' : 'Open'}
                </p>
              </div>
              {match.override_reason && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Override Reason</p>
                  <p className="text-sm text-amber-400 font-medium">{match.override_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Lineups Section (New Requested Feature) ── */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-beaufort font-bold uppercase tracking-widest text-[#c9aa71]">Team Lineups</h3>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9aa71]/20 via-[#c9aa71]/5 to-transparent"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Team 1 Blue Lineup */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                <span className="text-xs font-black uppercase tracking-widest text-cyan-400">{match.team1?.name} Lineup</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">Blue Side</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {team1Lineup.length > 0 ? (
                  team1Lineup.map((player: any) => (
                    <LineupPlayerCard key={player.id} player={player} color="blue" />
                  ))
                ) : (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-sm bg-slate-800/20 border border-slate-800/50 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-slate-700 opacity-30" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Team 2 Red Lineup */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                <span className="text-xs font-black uppercase tracking-widest text-rose-400">{match.team2?.name} Lineup</span>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">Red Side</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {team2Lineup.length > 0 ? (
                  team2Lineup.map((player: any) => (
                    <LineupPlayerCard key={player.id} player={player} color="red" />
                  ))
                ) : (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-sm bg-slate-800/20 border border-slate-800/50 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-slate-700 opacity-30" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Post-match Stats (Game History) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-beaufort font-bold uppercase tracking-widest text-[#c9aa71]">Game History</h3>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9aa71]/20 to-transparent"></div>
            </div>

            <div className="space-y-4">
              {match.games.length === 0 ? (
                <div className="p-12 text-center rounded-sm bg-[#0c121d]/40 border border-slate-800">
                  <div className="flex justify-center mb-4 opacity-10">
                    <Target size={48} />
                  </div>
                  <p className="text-slate-500 text-sm italic">No game-level performance data has been synchronized yet.</p>
                </div>
              ) : (
                match.games.map((game: any) => (
                  <div key={game.id} className="group relative bg-[#0c121d]/60 border border-slate-800 p-4 rounded-sm hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex flex-col items-center justify-center border border-white/5 bg-white/5 rounded-sm">
                          <span className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">GAME</span>
                          <span className="text-xl font-black">{game.game_number}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#c9aa71] mb-1">Duration</p>
                          <p className="text-sm font-bold">{game.duration ? `${Math.floor(game.duration / 60)}m ${game.duration % 60}s` : 'TBD'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 leading-none">Victory</p>
                        <p className={cn(
                          "text-sm font-black uppercase italic tracking-tighter transition-colors",
                          game.winner_id === match.team1?.id ? "text-cyan-400" : "text-rose-400"
                        )}>
                          {game.winner_id === match.team1?.id ? match.team1?.name : match.team2?.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar - Match Notes */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-beaufort font-bold uppercase tracking-widest text-[#c9aa71]">Directives</h3>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#c9aa71]/20 to-transparent"></div>
            </div>

            <div className="relative p-6 bg-[#0c121d]/60 border border-slate-800 rounded-sm">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <InfoIcon size={32} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c9aa71]"></div>
                Match Official Notes
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium italic">
                {match.notes || "No special directives issued for this engagement. Teams are expected to maintain professional standards and adhere to tournament protocols."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
