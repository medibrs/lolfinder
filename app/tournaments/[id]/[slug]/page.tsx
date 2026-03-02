import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Share2, CheckCircle, XCircle, AlertCircle, Shield, Crown } from 'lucide-react';
import { CalendarIcon, ClockIcon, TrophyIcon, TeamsIcon, InfoIcon, LiveIcon, UpcomingIcon, EndedIcon } from '@/components/TournamentIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { getRankImage } from '@/lib/rank-utils';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SwissBracketPreview } from '@/components/tournament/swiss-bracket-preview';
import { SingleEliminationBracketPreview } from '@/components/tournament/single-elimination-bracket-preview';
import { buildSwissBracketData } from '@/lib/swiss-bracket-data';
import { TournamentRegistrationBtn } from '@/components/tournament/tournament-registration-btn';
type Props = {
  params: Promise<{
    id: string;
    slug: string;
  }>;
};

// Fetch tournamenz by tournament_number (numeric ID)
async function getTournament(id: string) {
  const supabase = await createClient();

  // Check if id is numeric (tournament_number) or UUID
  const isNumeric = /^\d+$/.test(id);

  if (isNumeric) {
    // Look up by tournament_number
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('tournament_number', parseInt(id))
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  } else {
    // Fallback: look up by UUID (for backwards compatibility)
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }
    return data;
  }
}

// Fetch registered teams for the tournament
async function getRegisteredTeams(tournamentId: string) {
  const supabase = await createClient();

  // First get registrations
  const { data: registrations, error: regError } = await supabase
    .from('tournament_registrations')
    .select('id, status, registered_at, team_id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved');

  if (regError) {

    return [];
  }

  if (!registrations || registrations.length === 0) {
    return [];
  }

  // Then get teams for those registrations
  const teamIds = registrations.map(r => r.team_id);
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, team_size, recruiting_status, captain_id, team_avatar')
    .in('id', teamIds);

  if (teamsError) {

    return [];
  }

  // Fetch members for each team
  const { data: allMembers, error: membersError } = await supabase
    .from('players')
    .select('id, summoner_name, team_id, tier, main_role')
    .in('team_id', teamIds);

  if (membersError) {

  }

  // Calculate average rank for each team
  const rankOrder = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger'];

  // Combine the data
  const result = registrations.map(reg => {
    const team = teams?.find(t => t.id === reg.team_id);
    const members = allMembers?.filter(m => m.team_id === reg.team_id) || [];

    // Calculate average rank
    const memberRanks = members.map(m => {
      const tierBase = m.tier?.split(' ')[0];
      return rankOrder.indexOf(tierBase);
    }).filter(r => r >= 0);

    const avgRankIndex = memberRanks.length > 0
      ? Math.round(memberRanks.reduce((a, b) => a + b, 0) / memberRanks.length)
      : -1;
    const averageRank = avgRankIndex >= 0 ? rankOrder[avgRankIndex] : null;

    return {
      ...reg,
      teams: team ? { ...team, members, average_rank: averageRank } : null
    };
  });

  return result;
}

async function getMatchData(tournamentId: string) {
  // Use admin client because tournament_brackets has RLS with no public SELECT policy
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch matches
  const { data: matches, error: matchError } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('match_number', { ascending: true });

  if (matchError || !matches || matches.length === 0) return [];

  // Fetch brackets separately
  const bracketIds = [...new Set(matches.map(m => m.bracket_id).filter(Boolean))];
  const bracketsMap: Record<string, any> = {};

  if (bracketIds.length > 0) {
    const { data: brackets } = await supabase
      .from('tournament_brackets')
      .select('id, round_number, is_final, bracket_position')
      .in('id', bracketIds);

    for (const b of (brackets || [])) {
      bracketsMap[b.id] = b;
    }
  }

  // Fetch teams referenced in matches
  const allTeamIds = [...new Set([
    ...matches.map(m => m.team1_id).filter(Boolean),
    ...matches.map(m => m.team2_id).filter(Boolean),
    ...matches.map(m => m.winner_id).filter(Boolean),
  ])];

  const teamsMap: Record<string, any> = {};
  if (allTeamIds.length > 0) {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, team_avatar')
      .in('id', allTeamIds);

    for (const t of (teams || [])) {
      teamsMap[t.id] = t;
    }
  }

  return matches.map(m => ({
    ...m,
    bracket: bracketsMap[m.bracket_id] || null,
    team1: teamsMap[m.team1_id] || null,
    team2: teamsMap[m.team2_id] || null,
    winner: teamsMap[m.winner_id] || null,
  }));
}

async function getParticipants(tournamentId: string) {
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('*, team:teams(id, name, team_avatar)')
    .eq('tournament_id', tournamentId)
    .order('seed_number', { ascending: true });

  return participants || [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    return {
      title: 'Tournament Not Found',
      description: 'The requested tournament could not be found.',
    };
  }

  const description = tournament.description
    ? tournament.description.slice(0, 160)
    : `Join ${tournament.name} - A competitive League of Legends tournament. ${tournament.max_teams} teams, ${tournament.prize_pool || 'prizes'} up for grabs!`;

  return {
    title: tournament.name,
    description,
    openGraph: {
      title: `${tournament.name} | LoL Tournament`,
      description,
      type: 'website',
      images: ['/og-image.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tournament.name} | LoL Tournament`,
      description,
    },
  };
}

export default async function TournamentEventPage({ params }: Props) {
  const { id, slug } = await params;
  const tournament = await getTournament(id);
  const registeredTeams = tournament ? await getRegisteredTeams(tournament.id) : [];
  const matchData = tournament ? await getMatchData(tournament.id) : [];
  const participants = tournament ? await getParticipants(tournament.id) : [];

  if (!tournament) {
    notFound();
  }

  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  const now = new Date();

  const getTournamentStatus = () => {
    if (now < startDate) {
      return { status: 'upcoming', color: 'bg-orange-500', text: 'Upcoming' };
    } else if (now >= startDate && now <= endDate) {
      return { status: 'live', color: 'bg-green-500 animate-pulse', text: '● Live' };
    } else {
      return { status: 'completed', color: 'bg-zinc-600', text: 'Completed' };
    }
  };

  const tournamentStatus = getTournamentStatus();

  // Parse description into paragraphs
  const descriptionParagraphs = tournament.description
    ? tournament.description.split('\n').filter((p: string) => p.trim().length > 0)
    : [];

  // Parse rules into items
  const ruleItems = tournament.rules
    ? tournament.rules.split('\n').filter((r: string) => r.trim().length > 0)
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* ── FULL-BLEED HERO BANNER ── */}
      <div className="relative w-full h-[300px] md:h-[380px] overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-zinc-900"
          style={{ backgroundImage: `url(${tournament.banner_image || '/leet_lol_header.jpg'})` }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/50" />
        {/* Bottom gradient fade into page background */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* Hero content — pinned to bottom */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="max-w-7xl mx-auto px-4 pb-6">
            {/* Status + number */}
            <div className="flex items-center gap-3 mb-3">
              {tournamentStatus.status === 'upcoming' && (
                <UpcomingIcon size={32} className="drop-shadow-lg" />
              )}
              {tournamentStatus.status === 'live' && (
                <LiveIcon size={32} className="drop-shadow-lg animate-pulse" />
              )}
              {tournamentStatus.status === 'completed' && (
                <EndedIcon size={32} className="opacity-80" />
              )}
              <span className="text-zinc-500 text-sm font-mono ml-2">#{tournament.tournament_number}</span>
            </div>
            {/* Title */}
            {!(tournament.name === "1337 Leet E-Sports LoL Tournament" && (!tournament.banner_image || tournament.banner_image === '/leet_lol_header.jpg')) && (
              <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-5 drop-shadow-lg">
                {tournament.name}
              </h1>
            )}

            {/* Stats strip — glassmorphic */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 md:px-6 py-3 flex items-center justify-between gap-4 md:gap-8 flex-wrap">
              <div className="flex items-center gap-4 md:gap-8 flex-wrap">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} />
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-0.5">Start</p>
                    <p className="text-xs md:text-sm font-semibold text-white">{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} />
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-0.5">End</p>
                    <p className="text-xs md:text-sm font-semibold text-white">{endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-3">
                  <TrophyIcon size={20} />
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-0.5">Prize</p>
                    <p className="text-xs md:text-sm font-semibold text-white">{tournament.prize_pool || 'TBD'}</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10 hidden md:block" />
                <div className="flex items-center gap-3">
                  <TeamsIcon size={20} />
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-0.5">Teams</p>
                    <p className="text-xs md:text-sm font-semibold text-orange-400">{registeredTeams.length}/{tournament.max_teams}</p>
                  </div>
                </div>
              </div>

              {/* Registration CTA - Far Right */}
              {tournamentStatus.status === 'upcoming' && (
                <div className="ml-auto">
                  <TournamentRegistrationBtn tournamentId={tournament.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── MAIN COLUMN ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tournament Bracket Preview */}
            <div className="w-full">
              {tournament.format === 'Swiss' ? (
                <SwissBracketPreview
                  data={buildSwissBracketData(
                    tournament,
                    participants,
                    matchData
                  )}
                  teamCount={tournament.max_teams}
                />
              ) : tournament.format === 'Single_Elimination' ? (
                <SingleEliminationBracketPreview
                  teams={registeredTeams.map((r: any) => r.teams).filter(Boolean)}
                  teamCount={tournament.max_teams || 16}
                  matchData={matchData.length > 0 ? matchData : undefined}
                />
              ) : (
                <Card className="border-zinc-800 bg-zinc-900/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center min-h-[300px]">
                    <TrophyIcon size={48} className="opacity-20 mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">{tournament.format?.replace(/_/g, ' ') || 'Single Elimination'} Bracket</h3>
                    <p className="text-sm text-zinc-400 max-w-sm">
                      The bracket preview will be available once the tournament begins or seeding is completed.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>


            {/* Rules & Regulations */}
            {ruleItems.length > 0 && (
              <Card className="border-slate-800 bg-[#0b1221] overflow-hidden border-l-2 border-l-orange-500/60 py-0 gap-0 shadow-xl">
                <CardHeader className="px-5 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                  <CardTitle className="text-sm uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                      <Shield className="h-4 w-4 text-orange-400" />
                    </div>
                    Rules & Regulations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    {ruleItems.map((rule: string, index: number) => (
                      <div key={index} className="flex gap-4 items-start group">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-slate-800 flex items-center justify-center group-hover:bg-orange-500/20 group-hover:border-orange-500/40 transition-all duration-300">
                          <span className="text-xs font-bold text-slate-500 group-hover:text-orange-400">{index + 1}</span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed font-medium pt-1 group-hover:text-zinc-200 transition-colors">
                          {rule}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Teams Attending */}
            <Card className="border-slate-800 bg-[#0b1221] py-0 gap-0 overflow-hidden shadow-xl">
              <CardHeader className="px-5 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                <CardTitle className="text-sm uppercase tracking-wider font-bold text-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-400/10">
                      <TeamsIcon size={16} className="text-cyan-400" />
                    </div>
                    Teams Attending
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold border-slate-700 bg-white/5 text-slate-400">{registeredTeams.length}/{tournament.max_teams}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {registeredTeams.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {registeredTeams.map((registration: any) => {
                      const team = registration.teams;
                      if (!team) return null;

                      return (
                        <Link
                          key={team.id}
                          href={`/teams/${team.id}`}
                          className="group relative rounded-lg border border-zinc-700/50 hover:border-primary/50 transition-all duration-200 overflow-hidden h-40 block"
                        >
                          {/* Team Avatar Background */}
                          <div className="absolute inset-0">
                            {team.team_avatar ? (
                              <Image
                                src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${team.team_avatar}.png`}
                                alt="Team Avatar"
                                fill
                                className="object-cover"
                                unoptimized={process.env.NODE_ENV === 'development'}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800" />
                            )}
                            <div className="absolute inset-0 bg-black/60" />
                          </div>

                          {/* Average Rank Badge - Top Right */}
                          {team.average_rank && (
                            <div className="absolute top-1 right-1 z-10">
                              <Image
                                src={getRankImage(team.average_rank)}
                                alt={team.average_rank}
                                width={16}
                                height={16}
                                className="w-4 h-4"
                              />
                            </div>
                          )}

                          {/* Team Name - Centered */}
                          <div className="absolute inset-0 flex items-center justify-center p-3">
                            <p className="text-xs font-medium text-white text-center truncate w-full leading-tight">
                              {team.name}
                            </p>
                          </div>

                          {/* Hover/Tap Overlay - Players List */}
                          <div className="absolute inset-0 bg-zinc-900/95 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 flex flex-col p-2">
                            <p className="text-[10px] font-semibold text-zinc-400 mb-1 text-center truncate">{team.name}</p>
                            <div className="flex-1 flex flex-col justify-center space-y-0.5">
                              {team.members?.slice(0, 6).map((member: any) => (
                                <div key={member.id} className="flex items-center gap-1.5 text-[10px]">
                                  {member.tier ? (
                                    <Image
                                      src={getRankImage(member.tier)}
                                      alt={member.tier}
                                      width={14}
                                      height={14}
                                      className="w-3.5 h-3.5 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-3.5 h-3.5 flex-shrink-0" />
                                  )}
                                  {member.id === team.captain_id && (
                                    <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                                  )}
                                  <span className={cn(
                                    "truncate",
                                    member.id === team.captain_id ? "text-yellow-400 font-medium" : "text-zinc-300"
                                  )}>
                                    {member.summoner_name?.split('#')[0]}
                                  </span>
                                </div>
                              ))}
                              {(!team.members || team.members.length === 0) && (
                                <p className="text-[10px] text-zinc-500 text-center">No players</p>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-zinc-500 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">No teams registered yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── SIDEBAR ── */}
          <div className="space-y-4">
            {/* About / Description */}
            {descriptionParagraphs.length > 0 && (
              <Card className="border-slate-800 bg-[#0b1221] overflow-hidden py-0 gap-0 shadow-xl">
                <CardHeader className="px-4 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                  <CardTitle className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-400/10">
                      <InfoIcon size={14} className="text-cyan-400" />
                    </div>
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {descriptionParagraphs.map((paragraph: string, index: number) => (
                      <p key={index} className="text-xs text-zinc-400 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tournament Format */}
            <Card className="border-slate-800 bg-[#0b1221] py-0 gap-0 overflow-hidden shadow-xl">
              <CardHeader className="px-4 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                <CardTitle className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-400/10">
                    <TrophyIcon size={14} className="text-amber-400" />
                  </div>
                  Format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</span>
                  <Badge variant="outline" className="font-bold border-slate-700 text-amber-500/80 bg-amber-500/5">
                    {tournament.format?.replace(/_/g, ' ') || 'Single Elimination'}
                  </Badge>
                </div>

                {/* Swiss-specific info */}
                {tournament.format === 'Swiss' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Swiss Rounds</span>
                      <span className="text-sm font-bold text-slate-200">{tournament.swiss_rounds || 5}</span>
                    </div>
                    {tournament.enable_top_cut && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Top Cut</span>
                        <span className="text-sm font-bold text-slate-200">Top {tournament.top_cut_size || 8} → Playoffs</span>
                      </div>
                    )}
                  </>
                )}

                <Separator className="bg-slate-800/50" />

                {/* Match Formats */}
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Match Format</p>

                  {tournament.format === 'Swiss' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Opening</span>
                        <span className="text-xs font-bold text-slate-300">Bo{tournament.opening_best_of || 1}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Progression</span>
                        <span className="text-xs font-bold text-slate-300">Bo{tournament.progression_best_of || 3}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Elimination</span>
                        <span className="text-xs font-bold text-slate-300">Bo{tournament.elimination_best_of || 3}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Matches</span>
                        <span className="text-xs font-bold text-slate-300">Bo{tournament.elimination_best_of || 3}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400">Grand Finals</span>
                        <span className="text-xs font-bold text-slate-300">Bo{tournament.finals_best_of || 5}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-slate-800 bg-[#0b1221] py-0 gap-0 overflow-hidden shadow-xl">
              <CardHeader className="px-4 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                <CardTitle className="text-xs uppercase tracking-wider font-bold text-slate-200">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Teams</span>
                  <span className="text-sm font-bold text-slate-200">{registeredTeams.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Available Spots</span>
                  <span className="text-sm font-bold text-orange-400">{tournament.max_teams - registeredTeams.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Registration</span>
                  <Badge variant={tournamentStatus.status === 'upcoming' ? 'default' : 'secondary'} className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    tournamentStatus.status === 'upcoming' ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/20" : "bg-slate-800 text-slate-400 border-slate-700"
                  )}>
                    {tournamentStatus.status === 'upcoming' ? 'Open' : 'Closed'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
