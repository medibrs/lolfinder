import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getTournamentPath } from '@/lib/slugs'

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
  return `https://ddragon.leagueoflegends.com/cdn/16.4.1/img/profileicon/${avatarId}.png`
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
      notes,
      team1:teams!tournament_matches_team1_id_fkey(id, name, team_avatar),
      team2:teams!tournament_matches_team2_id_fkey(id, name, team_avatar),
      winner:teams!tournament_matches_winner_id_fkey(id, name),
      tournament:tournaments(id, name, tournament_number, format, banner_image)
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

  const [{ data: bracket }, { data: details }, { data: games }] = await Promise.all([
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
      .eq('match_id', id)
      .order('game_number', { ascending: true }),
    supabase
      .from('tournament_match_games')
      .select('id, game_number, duration, winner_id, game_data')
      .eq('match_id', id)
      .order('game_number', { ascending: true }),
  ])

  return {
    ...match,
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

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background text-white">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Match Center</div>

        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1221] p-6 md:p-8">
          <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${match.tournament?.banner_image || '/leet_lol_header.jpg'})` }} />
          <div className="absolute inset-0 bg-black/70" />

          <div className="relative space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">{match.tournament?.name || 'Tournament'}</p>
                <h1 className="text-2xl md:text-4xl font-black mt-1">
                  {match.team1?.name || 'TBD'} vs {match.team2?.name || 'TBD'}
                </h1>
                <p className="text-slate-400 text-sm mt-1">{stage} • BO{match.best_of || 1}</p>
              </div>

              <div className="text-right">
                <div className="text-3xl md:text-4xl font-black">
                  {match.team1_score ?? 0} - {match.team2_score ?? 0}
                </div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
                  {match.status === 'In_Progress' ? 'Live' : match.status === 'Completed' ? 'Final' : 'Scheduled'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3 justify-end">
                <span className="font-bold uppercase tracking-wide">{match.team1?.name || 'TBD'}</span>
                <img src={getTeamAvatarUrl(match.team1?.team_avatar) || '/favicon.ico'} alt={match.team1?.name || 'Team 1'} className="w-14 h-14 rounded-xl border border-blue-500/40 object-cover" />
              </div>
              <div className="text-center text-xs text-slate-400 uppercase tracking-widest">
                {matchTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
              <div className="flex items-center gap-3 justify-start">
                <img src={getTeamAvatarUrl(match.team2?.team_avatar) || '/favicon.ico'} alt={match.team2?.name || 'Team 2'} className="w-14 h-14 rounded-xl border border-red-500/40 object-cover" />
                <span className="font-bold uppercase tracking-wide">{match.team2?.name || 'TBD'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {match.stream_url && (
                <a
                  href={match.stream_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 rounded-md bg-[#c9aa71] text-black text-xs uppercase tracking-widest font-black hover:brightness-110 transition"
                >
                  Watch Stream
                </a>
              )}
              {match.tournament && (
                <Link
                  href={getTournamentPath(match.tournament.tournament_number || match.tournament.id, match.tournament.name)}
                  className="px-5 py-2 rounded-md border border-slate-700 text-slate-300 text-xs uppercase tracking-widest font-bold hover:border-cyan-500 hover:text-cyan-400 transition"
                >
                  Back to Tournament
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#0b1221] p-5">
          <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-4">Games</h2>

          {match.games.length === 0 && (
            <p className="text-slate-500 text-sm">No game-level stats recorded yet.</p>
          )}

          {match.games.length > 0 && (
            <div className="space-y-2">
              {match.games.map((game: any) => (
                <div key={game.id} className="flex items-center justify-between border border-slate-800 rounded-md p-3">
                  <div className="text-sm font-semibold">Game {game.game_number}</div>
                  <div className="text-xs text-slate-400">Duration: {game.duration ? `${Math.floor(game.duration / 60)}m` : 'TBD'}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {match.notes && (
          <section className="rounded-xl border border-slate-800 bg-[#0b1221] p-5">
            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">Match Notes</h2>
            <p className="text-slate-300 text-sm leading-relaxed">{match.notes}</p>
          </section>
        )}
      </div>
    </main>
  )
}
