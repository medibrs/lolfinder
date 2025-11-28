'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, ArrowLeft, Trophy, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'
import { getProfileIconUrl } from '@/lib/ddragon'

export default function ViewTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [leaving, setLeaving] = useState(false)
  const [profileIconUrls, setProfileIconUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    loadTeamData()
  }, [])

  const fetchProfileIconUrls = async (members: any[]) => {
    const urls: Record<string, string> = {}
    
    for (const member of members) {
      if (member.profile_icon_id) {
        try {
          const url = await getProfileIconUrl(member.profile_icon_id)
          urls[member.id] = url
        } catch (error) {
          console.error(`Failed to fetch profile icon for ${member.summoner_name}:`, error)
        }
      }
    }
    
    setProfileIconUrls(urls)
  }

  const loadTeamData = async () => {
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth')
        return
      }

      // Get player's team and summoner name
      const { data: playerData } = await supabase
        .from('players')
        .select('team_id, summoner_name')
        .eq('id', authUser.id)
        .single()

      if (!playerData?.team_id) {
        router.push('/teams')
        return
      }
      
      setUser({ ...authUser, summoner_name: playerData.summoner_name })

      // Get team data using the view
      const { data: teamData, error: teamError } = await supabase
        .from('team_with_players')
        .select('*')
        .eq('id', playerData.team_id)
        .single()

      if (teamError || !teamData) {
        router.push('/teams')
        return
      }

      setTeam(teamData)

      // Get team members from the players table directly to include profile_icon_id
      const { data: membersData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', playerData.team_id)
      
      setTeamMembers(membersData || [])
      
      // Fetch profile icon URLs for team members
      if (membersData && membersData.length > 0) {
        await fetchProfileIconUrls(membersData)
      }

      // Fetch tournament registrations (only approved - check both 'approved' and legacy 'Confirmed')
      const { data: tournamentsData } = await supabase
        .from('tournament_registrations')
        .select(`
          *,
          tournament:tournaments(*)
        `)
        .eq('team_id', playerData.team_id)
        .in('status', ['approved', 'Confirmed'])
        .order('registered_at', { ascending: false })

      setTournaments(tournamentsData || [])
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team? This action cannot be undone.')) {
      return
    }

    setLeaving(true)
    try {
      const supabase = createClient()

      // Remove player from team
      const { error: updateError } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('id', user.id)

      if (updateError) {
          return
      }

      // Send notification to captain
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: team.captain_id,
          type: 'team_member_left',
          title: `${user.summoner_name || 'A player'} left your team`,
          message: `${user.summoner_name || 'A team member'} has left ${team.name}. You now have ${teamMembers.length - 1} members.`,
          data: {
            team_id: team.id,
            team_name: team.name,
            player_id: user.id
          }
        })

      if (notificationError) {
        console.error('Error sending notification:', notificationError)
      }

      // Redirect to teams page
      router.push('/teams')
    } catch (error) {
      console.error('Error leaving team:', error)
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-4">Loading Team</h2>
          </div>
        </div>
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Team Not Found</h2>
            <Button asChild>
              <Link href="/teams">Browse Teams</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
              <Link href="/teams">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                <Crown className="w-8 h-8 text-yellow-500" />
                {team.name}
              </h1>
              <p className="text-muted-foreground">Your Team</p>
            </div>
          </div>
          <Button asChild variant="default">
            <Link href="/team-chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Team Chat
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Team Info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Team Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold">{team.name}</h3>
                    <p className="text-muted-foreground">{team.description || 'No description'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Looking For:</p>
                    <div className="flex flex-wrap gap-2">
                      {team.open_positions && team.open_positions.length > 0 ? (
                        team.open_positions.map((role: string) => (
                          <Badge key={role} variant="secondary">{role}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Not recruiting</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Status:</p>
                    <Badge className={
                      team.recruiting_status === 'Open' ? 'bg-green-600' :
                      team.recruiting_status === 'Closed' ? 'bg-red-600' :
                      'bg-gray-600'
                    }>
                      {team.recruiting_status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members ({teamMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Profile Icon with Rank Badge */}
                        <div className="relative">
                          {member.profile_icon_id ? (
                            <Image 
                              src={profileIconUrls[member.id] || ''}
                              alt="Profile Icon"
                              width={48}
                              height={48}
                              className="rounded-full border-2 border-border"
                              onError={(e) => {
                                // Fallback to question mark if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback = parent.querySelector('.fallback-icon');
                                  if (fallback) {
                                    (fallback as HTMLElement).style.display = 'flex';
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                              <span className="text-xl">?</span>
                            </div>
                          )}
                          {/* Fallback icon */}
                          <div className="fallback-icon w-12 h-12 bg-muted rounded-full flex items-center justify-center" style={{ display: 'none' }}>
                            <span className="text-xl">?</span>
                          </div>
                          {/* Rank Badge */}
                          <div className="absolute -bottom-1 -right-1">
                            <Image 
                              src={getRankImage(member.tier)} 
                              alt={member.tier}
                              width={20}
                              height={20}
                              className="object-contain"
                            />
                          </div>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate" title={member.summoner_name}>
                              {member.summoner_name.split('#')[0]}
                            </p>
                            {member.id === team.captain_id && (
                              <Badge className="bg-yellow-600">
                                <Crown className="w-3 h-3 mr-1" />
                                Captain
                              </Badge>
                            )}
                            {member.is_substitute && (
                              <Badge className="bg-blue-600">
                                Sub
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {member.main_role} • {member.tier}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {teamMembers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No team members yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Stats */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Team Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Team Size</span>
                  <span className="font-bold">{teamMembers.length}/6</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open Slots</span>
                  <span className="font-bold">{6 - teamMembers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-bold">{new Date(team.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Chat Guidelines */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Do's ✅</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Be respectful and supportive</li>
                      <li>• Share game strategies and tips</li>
                      <li>• Schedule practice times</li>
                      <li>• Coordinate for tournaments</li>
                      <li>• Celebrate wins together</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Don'ts ❌</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• No sharing personal information</li>
                      <li>• No spam or excessive caps</li>
                      <li>• No inappropriate content</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Remember: Team chat is for team coordination and building a positive team culture. Violations may result in team removal.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {user?.id === team.captain_id ? (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Captain Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/manage-team">Manage Team</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Team Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleLeaveTeam}
                    disabled={leaving}
                    variant="destructive"
                    className="w-full"
                  >
                    {leaving ? 'Leaving...' : 'Leave Team'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    You can rejoin or join another team anytime
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tournament Registrations */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Tournaments ({tournaments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tournaments.length > 0 ? (
                  <div className="space-y-3">
                    {tournaments.map((reg: any) => {
                      const tournament = reg.tournament
                      const slug = tournament?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tournament'
                      const tournamentUrl = `/tournaments/${tournament?.tournament_number}/${slug}`
                      
                      return (
                        <Link 
                          key={reg.id} 
                          href={tournamentUrl}
                          className="block p-3 border rounded-lg hover:border-primary/50 hover:bg-secondary/20 transition-all"
                        >
                          <div className="font-medium text-primary hover:underline">{tournament?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(tournament?.start_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Registered: {new Date(reg.registered_at).toLocaleDateString()}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    No tournament registrations yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
