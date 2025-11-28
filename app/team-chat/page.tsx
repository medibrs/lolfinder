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
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/view-team">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Team
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            {team.name} Team Chat
          </h1>
          <p className="text-muted-foreground">
            Private communication channel for team members
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={team.recruiting_status === 'Open' ? 'default' : 'secondary'}>
            {team.recruiting_status}
          </Badge>
          {isCaptain && (
            <Badge variant="outline" className="text-blue-500">
              Captain
            </Badge>
          )}
        </div>
      </div>

      {/* Team Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Team Name</p>
              <p className="font-semibold">{team.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Team Size</p>
              <p className="font-semibold">{team.team_size} players</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Members</p>
              <p className="font-semibold">{team.members?.length || 0} / {team.team_size}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Role</p>
              <p className="font-semibold">{isCaptain ? 'Team Captain' : 'Team Member'}</p>
            </div>
          </div>
          {team.description && (
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm">{team.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Chat */}
      <TeamChat
        teamId={team.id}
        teamName={team.name}
        isCaptain={isCaptain}
        isMember={isMember}
        compact={false}
      />

      {/* Chat Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Chat Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Do's</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Coordinate practice times and strategies</li>
                <li>• Discuss team composition and roles</li>
                <li>• Share tournament information</li>
                <li>• Support and encourage teammates</li>
                <li>• Plan scrims and matches</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">❌ Don'ts</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Share personal information</li>
                <li>• Use inappropriate language</li>
                <li>• Spam or flood the chat</li>
                <li>• Discuss other teams negatively</li>
                <li>• Share account credentials</li>
              </ul>
            </div>
          </div>
          {isCaptain && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Captain Note:</strong> You can clear the chat history if needed using the Clear button in the chat interface.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
