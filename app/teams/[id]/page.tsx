'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import ProfileSetupBanner from '@/components/ProfileSetupBanner'
import { getRankImage } from '@/lib/rank-utils'
import { getProfileIconUrl } from '@/lib/ddragon'
import RoleIcon from '@/components/RoleIcon'
import { Shield, Trophy, Users, Calendar, UserPlus, Edit, Gamepad2, Crown, ChevronLeft, Swords, Target } from 'lucide-react'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger']

const getTierColor = (tier: string) => {
  const colors: { [key: string]: string } = {
    'Iron': 'bg-gray-500',
    'Bronze': 'bg-orange-700',
    'Silver': 'bg-gray-400',
    'Gold': 'bg-yellow-500',
    'Platinum': 'bg-green-500',
    'Emerald': 'bg-emerald-500',
    'Diamond': 'bg-blue-500',
    'Master': 'bg-purple-500',
    'Grandmaster': 'bg-red-500',
    'Challenger': 'bg-cyan-400',
    'Unranked': 'bg-gray-600'
  }
  return colors[tier] || 'bg-gray-500'
}

const getTierGradient = (tier: string) => {
  const gradients: { [key: string]: string } = {
    'Iron': 'from-gray-600 to-gray-800',
    'Bronze': 'from-orange-600 to-orange-800',
    'Silver': 'from-gray-400 to-gray-600',
    'Gold': 'from-yellow-400 to-yellow-600',
    'Platinum': 'from-green-400 to-green-600',
    'Emerald': 'from-emerald-400 to-emerald-600',
    'Diamond': 'from-blue-400 to-blue-600',
    'Master': 'from-purple-400 to-purple-600',
    'Grandmaster': 'from-red-400 to-red-600',
    'Challenger': 'from-cyan-300 to-cyan-500',
    'Unranked': 'from-gray-500 to-gray-700'
  }
  return gradients[tier] || 'from-gray-500 to-gray-700'
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberRole, setNewMemberRole] = useState('')
  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [pendingRequest, setPendingRequest] = useState<string | null>(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false)
  const supabase = createClient()

  const handleSearchPlayers = () => {
    router.push('/players')
  }

  const handleEditTeam = () => {
    router.push('/manage-team')
  }

  const handleRegisterForTournament = () => {
    router.push('/tournaments')
  }



  const handleRequestToJoin = async () => {
    if (!currentUserId || sendingRequest) return

    try {
      setSendingRequest(true)
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/team-join-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          team_id: id,
          message: `I'd like to join ${team.name}!`
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPendingRequest(data.id)
      } else {
        const error = await response.json()

      }
    } catch (error) {

    } finally {
      setSendingRequest(false)
    }
  }

  const fetchProfileIconUrls = async (members: any[]) => {
    const urls: Record<string, string> = {};

    for (const member of members) {
      if (member.profile_icon_id) {
        try {
          const url = await getProfileIconUrl(member.profile_icon_id);
          urls[member.id] = url;
        } catch (error) {

        }
      }
    }

    setProfileIconUrls(urls);
  }

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUserId(user?.id || null)

        // Check if user has a team
        if (user) {
          const { data: playerData, error: playerError } = await supabase
            .from('players')
            .select('team_id')
            .eq('id', user.id)
            .single()



          if (playerError) {

            setHasPlayerProfile(false)
          } else {

            setHasPlayerProfile(true)

            if (playerData?.team_id) {
              const { data: teamData } = await supabase
                .from('teams')
                .select('*')
                .eq('id', playerData.team_id)
                .single()


              setUserTeam(teamData)
            }

            // Check if user has a pending request to this team
            const { data: requestData } = await supabase
              .from('team_join_requests')
              .select('id')
              .eq('player_id', user.id)
              .eq('team_id', id)
              .eq('status', 'pending')
              .single()

            if (requestData) {
              setPendingRequest(requestData.id)
            }
          }
        }

        // Fetch team data
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', id)
          .single()

        if (teamError) {

          return
        }

        setTeam(teamData)

        // Fetch team members
        const { data: membersData, error: membersError } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', id)

        if (!membersError && membersData) {
          setMembers(membersData)
          // Fetch profile icon URLs for members
          await fetchProfileIconUrls(membersData)

          // Additional check: if current user is in this team's members, ensure userTeam is set
          if (currentUserId && membersData.some(m => m.id === currentUserId)) {

            setUserTeam(teamData)
          }
        }
      } catch (error) {

      } finally {
        setLoading(false)
      }
    }

    fetchTeamData()
  }, [id, supabase])

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        {/* Banner skeleton */}
        <div className="relative w-full h-[340px] sm:h-[380px] lg:h-[420px] bg-gradient-to-b from-secondary to-background">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <div className="flex flex-col items-center justify-end h-full pb-16 px-4">
            {/* Crest */}
            <Skeleton className="w-28 h-28 lg:w-32 lg:h-32 rounded-full bg-slate-800 mb-5" />
            {/* Title */}
            <Skeleton className="h-10 w-56 sm:w-72 bg-slate-800 rounded mb-3" />
            {/* Captain subtitle */}
            <Skeleton className="h-4 w-40 bg-slate-800/60 rounded" />
          </div>
        </div>

        {/* Stats strip skeleton */}
        <div className="max-w-6xl mx-auto px-4 -mt-6 mb-8">
          <div className="flex items-center justify-center gap-0 bg-slate-950/60 border border-slate-800/40 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
              <Skeleton className="w-12 h-12 bg-slate-800 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-2 w-10 bg-slate-800 rounded" />
                <Skeleton className="h-4 w-16 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-9 h-9 bg-slate-800 rounded-md" />
                ))}
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2 w-10 bg-slate-800 rounded" />
                <Skeleton className="h-4 w-10 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
              <Skeleton className="w-2 h-2 bg-slate-800 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-2 w-10 bg-slate-800 rounded" />
                <Skeleton className="h-4 w-20 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Skeleton className="w-4 h-4 bg-slate-800 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-2 w-12 bg-slate-800 rounded" />
                <Skeleton className="h-4 w-16 bg-slate-800 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Roster grid skeleton */}
        <div className="max-w-6xl mx-auto px-4 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-[1px] flex-1 bg-slate-800" />
            <Skeleton className="h-3 w-28 bg-slate-800 rounded" />
            <div className="h-[1px] flex-1 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-950/70 border border-slate-800/60 rounded-lg p-4 min-h-[200px]">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="w-12 h-12 bg-slate-800 rounded-md" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-24 bg-slate-800 rounded" />
                    <Skeleton className="h-2.5 w-14 bg-slate-800/60 rounded" />
                  </div>
                </div>
                <Skeleton className="h-3 w-20 bg-slate-800/60 rounded mb-3" />
                <Skeleton className="h-3 w-28 bg-slate-800/60 rounded mb-2" />
                <Skeleton className="h-1 w-full bg-slate-800 rounded-full mt-4" />
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-slate-800 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-300 mb-2">Team not found</h1>
          <p className="text-slate-600 mb-6 text-sm">This team may have been disbanded or doesn't exist.</p>
          <Button asChild variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/5 text-xs uppercase tracking-widest font-bold">
            <Link href="/teams">Back to Teams</Link>
          </Button>
        </div>
      </main>
    )
  }

  const isCaptain = currentUserId === team.captain_id
  const captain = members.find(m => m.id === team.captain_id)
  const neededRoles = team.open_positions || []
  const teamSize = team.team_size || 5
  const averageTier = members.length > 0
    ? members.reduce((acc, m) => {
      const tierIndex = TIERS.indexOf((m.tier || '').split(' ')[0])
      return tierIndex >= 0 ? acc + tierIndex : acc
    }, 0) / members.filter(m => {
      const tierIndex = TIERS.indexOf((m.tier || '').split(' ')[0])
      return tierIndex >= 0
    }).length
    : 0

  return (
    <main className="min-h-screen bg-background">
      {/* ═══════════════ 1. BATTLE STANDARD — Hero Banner ═══════════════ */}
      <div className="relative w-full h-[340px] sm:h-[380px] lg:h-[420px] overflow-hidden">
        {/* Background — Dark moody Hextech forge glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-secondary via-card to-background" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Bottom fade to page bg */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        {/* Decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-10">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-cyan-400 hover:bg-transparent text-xs uppercase tracking-widest font-bold gap-1.5 px-0">
            <Link href="/teams">
              <ChevronLeft className="h-4 w-4" />
              Teams
            </Link>
          </Button>
        </div>

        {/* Captain Actions float top-right */}
        {isCaptain && (
          <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
            <Button
              onClick={handleEditTeam}
              variant="ghost"
              className="text-xs uppercase tracking-widest text-slate-500 hover:text-amber-400 hover:bg-amber-400/5 font-bold gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              onClick={handleRegisterForTournament}
              variant="ghost"
              className="text-xs uppercase tracking-widest text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/5 font-bold gap-1.5"
            >
              <Trophy className="h-3.5 w-3.5" />
              Tournaments
            </Button>
          </div>
        )}

        {/* Banner Content */}
        <div className="relative z-[5] h-full flex flex-col items-center justify-end pb-16 sm:pb-20 px-4">
          {/* Team Crest — large emblem overlapping banner bottom */}
          <div className="relative mb-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 border-amber-500/40 shadow-[0_0_40px_rgba(202,138,4,0.15),0_0_80px_rgba(8,145,178,0.08)] bg-[#0a1628]">
              {team.team_avatar ? (
                <Image
                  src={getTeamAvatarUrl(team.team_avatar)!}
                  alt="Team Avatar"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                  <Shield className="h-12 w-12 sm:h-14 sm:w-14 text-amber-500/60" />
                </div>
              )}
            </div>
            {/* Decorative ring */}
            <div className="absolute -inset-1 rounded-full border border-amber-500/10 pointer-events-none" />
            <div className="absolute -inset-2.5 rounded-full border border-cyan-500/5 pointer-events-none" />
          </div>

          {/* Team Name — Leaderboard-style gold header */}
          <div className="text-center mb-1">
            <div className="flex items-center justify-center gap-4 mb-2">
              <div className="h-[1px] flex-1 max-w-[200px] bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-beaufort font-black uppercase tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
                {team.name}
              </h1>
              <div className="h-[1px] flex-1 max-w-[200px] bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
            </div>
            <div className="flex items-center justify-center gap-1.5 opacity-60">
              <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">
                Captain: {captain?.summoner_name || captain?.riot_games_name || 'Unknown'}
              </span>
              <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
            </div>
          </div>

          {isCaptain && (
            <Badge className="mt-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-sm text-[10px] uppercase tracking-widest font-bold px-3 py-0.5 hover:bg-amber-500/15">
              Your Team
            </Badge>
          )}
        </div>
      </div>

      {/* Profile Setup Banner */}
      {currentUserId && !hasPlayerProfile && (
        <div className="max-w-6xl mx-auto px-4 -mt-4 mb-6 relative z-10">
          <ProfileSetupBanner description="Create your profile to join teams and participate in tournaments" />
        </div>
      )}

      {/* ═══════════════ 2. WAR ROOM — Stats Strip ═══════════════ */}
      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10 mb-8">
        <div className="flex flex-wrap items-center justify-center gap-x-0 sm:gap-x-0 bg-slate-950/60 backdrop-blur-md border border-slate-800/60 rounded-lg overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
          {/* Average Rank Crest */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12">
              <Image
                src={getRankImage(TIERS[Math.round(averageTier)] || 'Unranked')}
                alt="Team Rank"
                width={48}
                height={48}
                className="object-contain drop-shadow-[0_0_8px_rgba(202,138,4,0.3)]"
              />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Avg Rank</div>
              <div className="text-sm font-black text-slate-200">{TIERS[Math.round(averageTier)] || 'Unranked'}</div>
            </div>
          </div>

          {/* Member Slots — visual Hextech slots */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: teamSize }).map((_, i) => {
                const member = members[i]
                return (
                  <div
                    key={i}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-md overflow-hidden border transition-all duration-300 ${
                      member
                        ? 'border-cyan-500/40 shadow-[0_0_8px_rgba(8,145,178,0.2)] bg-slate-900'
                        : 'border-slate-800/60 bg-slate-900/30'
                    }`}
                  >
                    {member ? (
                      profileIconUrls[member.id] ? (
                        <Image
                          src={profileIconUrls[member.id]}
                          alt={member.summoner_name}
                          width={36}
                          height={36}
                          className="w-full h-full object-cover opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-cyan-500/60" />
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2.5 h-2.5 border border-dashed border-slate-700 rounded-sm" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Roster</div>
              <div className="text-sm font-black text-slate-200">{members.length}<span className="text-slate-600">/{teamSize}</span></div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-r border-slate-800/40">
            <div className={`w-2 h-2 rounded-full ${team.recruiting_status === 'Open' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse' : 'bg-slate-600'}`} />
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Status</div>
              <div className={`text-sm font-black ${team.recruiting_status === 'Open' ? 'text-emerald-400' : 'text-slate-400'}`}>
                {team.recruiting_status === 'Open' ? 'Recruiting' : team.recruiting_status || 'Closed'}
              </div>
            </div>
          </div>

          {/* Founded */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <Calendar className="h-4 w-4 text-slate-600" />
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Founded</div>
              <div className="text-sm font-black text-slate-200">
                {team.created_at ? new Date(team.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ 3. LOOKING FOR ROLES — Compact Strip ═══════════════ */}
      {neededRoles.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 mb-8">
          <div className="flex items-center gap-4 px-5 py-3 bg-cyan-950/15 border border-cyan-500/10 rounded-lg">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500/70 font-bold whitespace-nowrap">
              <Target className="h-3.5 w-3.5" />
              Recruiting
            </div>
            <div className="w-[1px] h-5 bg-cyan-500/10" />
            <div className="flex flex-wrap gap-2">
              {neededRoles.map((role: string) => (
                <div key={role} className="flex items-center gap-1.5 bg-cyan-500/5 border border-cyan-500/15 rounded px-2.5 py-1">
                  <RoleIcon role={role} size={16} />
                  <span className="text-xs font-bold text-cyan-300/90">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ 4. LCS STARTING LINEUP — Roster ═══════════════ */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-800" />
          <h2 className="text-[11px] uppercase tracking-[0.3em] text-slate-500 font-bold flex items-center gap-2">
            <Swords className="h-3.5 w-3.5" />
            Starting Lineup
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-800" />
        </div>

        {/* Roster Grid — Horizontal pillar layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Filled Player Cards */}
          {members.map(member => {
            const winRate = member.wins !== undefined && member.losses !== undefined && (member.wins + member.losses) > 0
              ? Math.round((member.wins / (member.wins + member.losses)) * 100)
              : null
            const tierBase = (member.tier || 'Unranked').split(' ')[0]

            return (
              <div
                key={member.id}
                className="group relative bg-slate-950/70 border border-slate-800/60 rounded-lg overflow-hidden hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(8,145,178,0.08)]"
              >
                {/* Rank watermark background */}
                <div className="absolute top-2 right-2 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                  <Image
                    src={getRankImage(member.tier || 'Unranked')}
                    alt=""
                    width={100}
                    height={100}
                    className="object-contain"
                  />
                </div>

                {/* Captain crown indicator */}
                {member.id === team.captain_id && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                )}

                <div className="relative p-4">
                  {/* Player icon + name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-md overflow-hidden border border-slate-700/60 bg-slate-900">
                        {member.profile_icon_id && profileIconUrls[member.id] ? (
                          <Image
                            src={profileIconUrls[member.id]}
                            alt="Icon"
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-slate-700 text-lg">?</span>
                          </div>
                        )}
                      </div>
                      {/* Small rank badge */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5">
                        <Image
                          src={getRankImage(member.tier || 'Unranked')}
                          alt={member.tier || 'Unranked'}
                          width={20}
                          height={20}
                          className="object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {member.id === team.captain_id && (
                          <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="font-bold text-sm text-slate-200 truncate">
                          {member.summoner_name?.split('#')[0] || member.riot_games_name || 'Unknown'}
                        </span>
                      </div>
                      {member.summoner_name?.split('#')[1] && (
                        <span className="text-[10px] text-slate-600 font-mono">#{member.summoner_name.split('#')[1]}</span>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <RoleIcon role={member.main_role} size={14} />
                      <span className="text-slate-400 font-semibold">{member.main_role}</span>
                    </div>
                    {member.secondary_role && (
                      <>
                        <span className="text-slate-800">·</span>
                        <div className="flex items-center gap-1 text-xs">
                          <RoleIcon role={member.secondary_role} size={12} />
                          <span className="text-slate-500">{member.secondary_role}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Rank info */}
                  <div className="text-xs text-slate-400 font-semibold mb-2">
                    {member.tier || 'Unranked'}
                    {member.rank && <span className="ml-1 text-slate-500">{member.rank}</span>}
                    {member.league_points > 0 && <span className="text-slate-600 ml-1">({member.league_points} LP)</span>}
                  </div>

                  {/* Win/Loss bar */}
                  {winRate !== null && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-emerald-500">{member.wins}W</span>
                        <span className={`${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>{winRate}%</span>
                        <span className="text-red-500">{member.losses}L</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-800 overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${winRate}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500"
                          style={{ width: `${100 - winRate}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Level */}
                  {member.summoner_level && (
                    <div className="mt-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                      Lv. {member.summoner_level}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty Recruiting Slots */}
          {Array.from({ length: Math.max(0, teamSize - members.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="relative bg-slate-950/30 border-2 border-dashed border-slate-800/60 rounded-lg overflow-hidden group"
            >
              <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
                {/* Pulsing glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="w-12 h-12 rounded-md border border-dashed border-slate-700/50 flex items-center justify-center mb-3 group-hover:border-cyan-500/30 transition-colors">
                  <UserPlus className="h-5 w-5 text-slate-700 group-hover:text-cyan-500/50 transition-colors" />
                </div>

                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-700 font-bold group-hover:text-cyan-500/40 transition-colors animate-pulse">
                  Recruiting
                </span>

                {/* Join button for eligible users */}
                {(() => {
                  const canRequestToJoin = currentUserId && hasPlayerProfile && !userTeam && !isCaptain && team.recruiting_status === 'Open'
                  if (canRequestToJoin && i === 0) {
                    return (
                      <div className="mt-3">
                        {pendingRequest ? (
                          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] uppercase tracking-wider">
                            Request Pending
                          </Badge>
                        ) : (
                          <Button
                            onClick={handleRequestToJoin}
                            disabled={sendingRequest}
                            className="h-7 px-3 text-[10px] uppercase tracking-widest font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(8,145,178,0.2)]"
                          >
                            {sendingRequest ? 'Sending...' : 'Request to Join'}
                          </Button>
                        )}
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* Join team info for non-eligible users */}
        {members.length < teamSize && (() => {
          const canRequestToJoin = currentUserId && hasPlayerProfile && !userTeam && !isCaptain && team.recruiting_status === 'Open'
          if (canRequestToJoin) return null

          return (
            <div className="mt-4 text-center text-xs text-slate-600">
              {currentUserId && userTeam ? (
                <span>You're already in a team</span>
              ) : team.recruiting_status !== 'Open' ? (
                <span>This team is not currently recruiting</span>
              ) : !currentUserId ? (
                <span>Sign in to request joining this team</span>
              ) : !hasPlayerProfile ? (
                <span>Complete your profile to join teams</span>
              ) : null}
            </div>
          )
        })()}
      </div>

      {/* Captain quick-actions (bottom, only for captains) */}
      {isCaptain && showAddMember && (
        <div className="max-w-6xl mx-auto px-4 mb-12">
          <div className="bg-slate-950/60 border border-slate-800/40 rounded-lg p-5 backdrop-blur-sm">
            <h3 className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Find Players by Role</h3>
            <div className="flex gap-3">
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-800 rounded text-sm text-slate-300 focus:border-cyan-500/50 outline-none"
              >
                <option value="">Select Role</option>
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <Button
                onClick={handleSearchPlayers}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider px-5 shadow-[0_0_10px_rgba(8,145,178,0.15)]"
              >
                <Users className="h-3.5 w-3.5 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Players toggle (captain only, floating at bottom) */}
      {isCaptain && (
        <div className="max-w-6xl mx-auto px-4 mb-12 flex justify-center">
          <Button
            onClick={() => setShowAddMember(!showAddMember)}
            variant="ghost"
            className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/5 font-bold gap-2"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {showAddMember ? 'Hide Player Search' : 'Find Players to Invite'}
          </Button>
        </div>
      )}
    </main>
  )
}
