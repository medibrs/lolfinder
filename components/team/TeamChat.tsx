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
    <Card className={`mt-4 p-0 flex flex-col ${compact ? "h-[500px]" : "h-[600px]"}`}>
      {isCaptain && (
        <div className="px-4 pt-2 pb-2">
          <div className="flex items-center gap-2 text-xs text-blue-500">
            <Shield className="h-3 w-3" />
            Team Captain
          </div>
        </div>
      )}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <RealtimeChatPersistent
          roomName={roomName}
          username={summonerName} // Use summoner name from player profile
          enablePersistence={true}
          maxHeight={compact ? "350px" : "480px"}
        />
      </CardContent>
    </Card>
  )
}
