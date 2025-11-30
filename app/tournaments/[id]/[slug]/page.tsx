import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Calendar, Trophy, Users, Clock, DollarSign, Info, CheckCircle, XCircle, AlertCircle, Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { getRankImage } from '@/lib/rank-utils';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SwissBracketPreview } from '@/components/tournament/swiss-bracket-preview';

type Props = {
  params: Promise<{
    id: string;
    slug: string;
  }>;
};

// Fetch tournament by tournament_number (numeric ID)
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
    console.error('Error fetching registrations:', regError);
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
    console.error('Error fetching teams:', teamsError);
    return [];
  }
  
  // Fetch members for each team
  const { data: allMembers, error: membersError } = await supabase
    .from('players')
    .select('id, summoner_name, team_id, tier, main_role')
    .in('team_id', teamIds);
  
  if (membersError) {
    console.error('Error fetching members:', membersError);
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tournament = await getTournament(id);
  
  if (!tournament) {
    return {
      title: 'Tournament Not Found',
      description: 'The requested tournament could not be found.',
    };
  }
  
  return {
    title: `${tournament.name} | Tournament`,
    description: tournament.description || 'Tournament event page',
  };
}

export default async function TournamentEventPage({ params }: Props) {
  const { id, slug } = await params;
  const tournament = await getTournament(id);
  const registeredTeams = tournament ? await getRegisteredTeams(tournament.id) : [];
  
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
      return { status: 'live', color: 'bg-green-500', text: 'Live' };
    } else {
      return { status: 'completed', color: 'bg-zinc-500', text: 'Completed' };
    }
  };
  
  const tournamentStatus = getTournamentStatus();
  
  return (
    <div className="min-h-screen pt-20 pb-8 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header with Background */}
        <div className="relative h-48 md:h-64 rounded-xl overflow-hidden mb-6">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-zinc-900"
            style={{
              backgroundImage: 'url(/leet_lol_header.jpg)',
              filter: 'brightness(0.4)'
            }}
          />
          <div className="relative h-full flex flex-col justify-end p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={`${tournamentStatus.color} text-white text-xs px-2 py-1`}>
                    {tournamentStatus.text}
                  </Badge>
                  <span className="text-zinc-400 text-sm">#{tournament.tournament_number}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{tournament.name}</h1>
                <p className="text-zinc-300 text-sm line-clamp-2 mb-4">{tournament.description || 'No description available'}</p>
              </div>
            </div>
            
            {/* Tournament Details Bar */}
            <div className="bg-black/70 backdrop-blur-sm rounded-lg px-2 md:px-4 py-2 mt-4">
              <div className="flex items-center justify-between gap-2 md:gap-4 text-white">
                <div className="flex items-center gap-1 md:gap-2">
                  <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-zinc-400" />
                  <span className="text-[10px] md:text-xs font-medium">{startDate.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-zinc-400" />
                  <span className="text-[10px] md:text-xs font-medium">{endDate.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Trophy className="h-3 w-3 md:h-3.5 md:w-3.5 text-zinc-400" />
                  <span className="text-[10px] md:text-xs font-medium">{tournament.prize_pool || 'TBD'}</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Users className="h-3 w-3 md:h-3.5 md:w-3.5 text-zinc-400" />
                  <span className="text-[10px] md:text-xs font-medium text-orange-500">{tournament.max_teams}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Swiss Bracket */}
            <div className="w-full">
              <SwissBracketPreview 
                teams={registeredTeams.map((r: any) => r.teams).filter(Boolean)} 
                maxWins={Math.ceil((tournament.swiss_rounds || 4) / 2)}
                maxLosses={Math.ceil((tournament.swiss_rounds || 4) / 2)}
              />
            </div>

            {/* Teams Attending */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Teams attending
                  </div>
                  <Badge variant="secondary">{registeredTeams.length}/{tournament.max_teams}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800" />
                            )}
                            {/* Dark overlay for text visibility */}
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

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Tournament Format */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                {/* Format Type */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Type</span>
                  <Badge variant="outline" className="font-medium">
                    {tournament.format?.replace(/_/g, ' ') || 'Single Elimination'}
                  </Badge>
                </div>
                
                {/* Swiss-specific info */}
                {tournament.format === 'Swiss' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Swiss Rounds</span>
                      <span className="text-sm font-medium">{tournament.swiss_rounds || 5}</span>
                    </div>
                    {tournament.enable_top_cut && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Top Cut</span>
                        <span className="text-sm font-medium">Top {tournament.top_cut_size || 8} → Playoffs</span>
                      </div>
                    )}
                  </>
                )}
                
                <Separator className="bg-zinc-800" />
                
                {/* Match Formats */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Match Format</p>
                  
                  {tournament.format === 'Swiss' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Opening</span>
                        <span className="text-sm font-medium">Bo{tournament.opening_best_of || 1}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Progression</span>
                        <span className="text-sm font-medium">Bo{tournament.progression_best_of || 3}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Elimination</span>
                        <span className="text-sm font-medium">Bo{tournament.elimination_best_of || 3}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Matches</span>
                        <span className="text-sm font-medium">Bo{tournament.elimination_best_of || 3}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Grand Finals</span>
                        <span className="text-sm font-medium">Bo{tournament.finals_best_of || 5}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="border-zinc-800">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Total Teams</span>
                  <span className="text-sm font-medium">{registeredTeams.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Available Spots</span>
                  <span className="text-sm font-medium text-orange-500">{tournament.max_teams - registeredTeams.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Registration</span>
                  <Badge variant={tournamentStatus.status === 'upcoming' ? 'default' : 'secondary'} className="text-xs">
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
