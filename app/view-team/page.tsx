'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getRankImage } from '@/lib/rank-utils'

export default function ViewTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  useEffect(() => {
    loadTeamData()
  }, [])

  const loadTeamData = async () => {
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth')
        return
      }
      
      setUser(authUser)

      // Get player's team
      const { data: playerData } = await supabase
        .from('players')
        .select('team_id')
        .eq('id', authUser.id)
        .single()

      if (!playerData?.team_id) {
        router.push('/teams')
        return
      }

      // Get team data using the view
      const { data: teamData, error: teamError } = await supabase
        .from('team_with_players')
        .select('*')
        .eq('id', playerData.team_id)
        .single()

      if (teamError || !teamData) {
        console.log('Team error:', teamError)
        router.push('/teams')
        return
      }

      setTeam(teamData)

      // Get team members from the view's players array or query directly
      if (teamData.players && Array.isArray(teamData.players)) {
        setTeamMembers(teamData.players)
      } else {
        // Fallback: query players directly
        const { data: membersData } = await supabase
          .from('players')
          .select('*')
          .eq('team_id', playerData.team_id)

        setTeamMembers(membersData || [])
      }
    } catch (error) {
      console.error('Error loading team data:', error)
    } finally {
      setLoading(false)
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
        <div className="flex items-center gap-4 mb-8">
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
                      <div className="flex items-center gap-3">
                        <Image 
                          src={getRankImage(member.tier)} 
                          alt={member.tier}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{member.summoner_name}</p>
                            {member.id === team.captain_id && (
                              <Badge className="bg-yellow-600">
                                <Crown className="w-3 h-3 mr-1" />
                                Captain
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
                  <span className="font-bold">{teamMembers.length}/{team.team_size || 5}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open Slots</span>
                  <span className="font-bold">{(team.team_size || 5) - teamMembers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-bold">{new Date(team.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {user?.id === team.captain_id && (
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
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
