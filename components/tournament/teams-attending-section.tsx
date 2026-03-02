import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TeamsIcon } from '@/components/TournamentIcons';
import { AlertCircle, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRankImage } from '@/lib/rank-utils';
import { getTeamAvatarUrl } from '@/components/ui/team-avatar';

export interface TeamsAttendingSectionProps {
    registeredTeams: any[];
    maxTeams?: number;
}

export function TeamsAttendingSection({ registeredTeams, maxTeams }: TeamsAttendingSectionProps) {
    return (
        <Card className="border-slate-800 bg-[#0b1221] py-0 gap-0 overflow-hidden shadow-xl">
            <CardHeader className="px-5 py-3 !pb-3 border-b border-slate-800/50 bg-white/5">
                <CardTitle className="text-sm uppercase tracking-wider font-bold text-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-cyan-400/10">
                            <TeamsIcon size={16} className="text-cyan-400" />
                        </div>
                        Teams Attending
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-slate-700 bg-white/5 text-slate-400">
                        {registeredTeams.length}/{maxTeams || '?'}
                    </Badge>
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
                                                src={team.team_avatar || ''}
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
    );
}
