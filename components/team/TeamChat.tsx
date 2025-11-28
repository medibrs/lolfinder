'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RealtimeChatPersistent } from '@/components/realtime-chat-persistent'
import { Users, MessageSquare, Shield } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TeamChatProps {
  teamId: string
  teamName: string
  isCaptain?: boolean
  isMember?: boolean
  compact?: boolean
}

export function TeamChat({ 
  teamId, 
  teamName, 
  isCaptain = false, 
  isMember = false,
  compact = false 
}: TeamChatProps) {
  const [summonerName, setSummonerName] = useState<string>('Player')

  // Load current user's summoner name from player profile
  useEffect(() => {
    const loadSummonerName = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          const { data: playerData } = await supabase
            .from('players')
            .select('summoner_name')
            .eq('id', user.id)
            .single()
          
          if (playerData?.summoner_name) {
            setSummonerName(playerData.summoner_name)
          }
        }
      } catch (error) {
        console.error('Error loading summoner name:', error)
      }
    }
    loadSummonerName()
  }, [])
  // Only team members can access the chat
  if (!isMember) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Team Chat
          </CardTitle>
          <CardDescription>
            Private chat for team members only
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            You must be a team member to access the team chat.
          </p>
        </CardContent>
      </Card>
    )
  }

  const roomName = `team-${teamId}`
  const chatTitle = compact ? "Team Chat" : `${teamName} Chat`

  return (
    <Card className={compact ? "h-[500px]" : "h-[600px]"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {chatTitle}
          {isCaptain && (
            <Shield className="h-4 w-4 text-blue-500" />
          )}
        </CardTitle>
        <CardDescription>
          Private communication channel for {teamName} team members.
          Messages are saved permanently and visible to all team members.
        </CardDescription>
      </CardHeader>
      <CardContent className={`h-[${compact ? '400px' : '500px'}] p-0`}>
        <RealtimeChatPersistent
          roomName={roomName}
          username={summonerName} // Use summoner name from player profile
          enablePersistence={true}
          showClearHistory={isCaptain} // Only captains can clear team chat history
          maxHeight={compact ? "350px" : "450px"}
        />
      </CardContent>
    </Card>
  )
}
