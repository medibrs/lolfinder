'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TeamChat } from '@/components/team/TeamChat'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Users, ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'

interface Team {
  id: string
  name: string
  description?: string
  captain_id: string
  team_size: string
  recruiting_status: string
  members?: Array<{
    id: string
    summoner_name: string
    role: string
  }>
}

export default function TeamChatPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const loadTeamAndUser = async () => {
      try {
        const supabase = createClient()
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (!user) {
          setLoading(false)
          return
        }

        // Get user's team
        const { data: playerData } = await supabase
          .from('players')
          .select('team_id')
          .eq('id', user.id)
          .single()

        if (!playerData?.team_id) {
          setLoading(false)
          return
        }

        // Get team details with members
        const { data: teamData, error } = await supabase
          .from('team_with_players')
          .select('*')
          .eq('id', playerData.team_id)
          .single()

        if (error) {
          console.error('Error loading team:', error)
          setLoading(false)
          return
        }

        setTeam(teamData)
        setIsCaptain(teamData.captain_id === user.id)
        setIsMember(true) // If they have a team_id, they're a member

      } catch (error) {
        console.error('Error loading team chat:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTeamAndUser()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to access team chat.
            </p>
            <Link href="/auth">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Team Found</h2>
            <p className="text-muted-foreground mb-4">
              You need to join a team to access team chat.
            </p>
            <Link href="/teams">
              <Button>Browse Teams</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto pt-24 pb-4">
      {/* Simple Back Button */}
      <div className="mb-4">
        <Link href="/view-team">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Team
          </Button>
        </Link>
      </div>

      {/* Full Width Chat */}
      <TeamChat
        teamId={team.id}
        teamName={team.name}
        isCaptain={isCaptain}
        isMember={isMember}
        compact={false}
      />
    </div>
  )
}
