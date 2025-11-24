'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

export default function CreateTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [canCreateTeam, setCanCreateTeam] = useState(true)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    captain_id: '',
    team_size: '5' as '5' | '6', // 5 players (main) or 6 players (5 + sub)
    open_positions: [] as string[],
    recruiting_status: 'Open' as 'Open' | 'Closed' | 'Full'
  })

  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get current user and check if they can create a team
    const getCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/user')
        if (response.ok) {
          const { user } = await response.json()
          setUserId(user.id)
          setFormData(prev => ({ ...prev, captain_id: user.id }))
          
          // Check if user already has a team or is in a team
          await checkTeamEligibility(user.id)
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      } finally {
        setCheckingStatus(false)
      }
    }
    getCurrentUser()
  }, [])

  const checkTeamEligibility = async (userId: string) => {
    try {
      const supabase = createClient()
      
      // Check if user has a complete profile
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('team_id, summoner_name, discord, main_role, tier')
        .eq('id', userId)
        .single()
      
      if (playerError || !playerData) {
        setCanCreateTeam(false)
        setBlockReason('no_profile')
        return
      }
      
      // Check if profile is complete
      if (!playerData.summoner_name || !playerData.discord || !playerData.main_role || !playerData.tier) {
        setCanCreateTeam(false)
        setBlockReason('incomplete_profile')
        return
      }
      
      // Check if user is already in a team
      if (playerData?.team_id) {
        setCanCreateTeam(false)
        setBlockReason('already_in_team')
        return
      }
      
      // Check if user already owns a team
      const { data: teamData } = await supabase
        .from('teams')
        .select('id')
        .eq('captain_id', userId)
        .single()
      
      if (teamData) {
        setCanCreateTeam(false)
        setBlockReason('already_created_team')
      }
    } catch (error) {
      console.error('Error checking team eligibility:', error)
      setCanCreateTeam(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      open_positions: prev.open_positions.includes(role)
        ? prev.open_positions.filter(r => r !== role)
        : [...prev.open_positions, role]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const errorData = await response.json()
        console.error('Error creating team:', errorData)
        
        // Handle specific error messages
        if (errorData.error?.includes('duplicate key') || errorData.error?.includes('teams_name_key')) {
          setError('This team name is already taken. Please choose a different name for your team.')
        } else if (errorData.error?.includes('already in a team')) {
          setError('You are already in a team and cannot create a new team.')
        } else if (errorData.error?.includes('already created a team')) {
          setError('You have already created a team and cannot create another.')
        } else {
          setError(errorData.error || 'Failed to create team. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error creating team:', error)
      setError('Failed to create team. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="bg-card border-border p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold mb-4">Checking Team Eligibility</h2>
              <p className="text-muted-foreground">
                Verifying if you can create a new team...
              </p>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  if (!canCreateTeam) {
    const getErrorContent = () => {
      switch (blockReason) {
        case 'no_profile':
          return {
            title: 'Profile Required',
            message: 'You must create a player profile before creating a team. Please complete your profile first.',
            actions: [
              <Button key="profile" asChild className="bg-primary hover:bg-primary/90">
                <Link href="/setup-profile">Create Profile</Link>
              </Button>,
              <Button key="home" asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            ]
          }
        case 'incomplete_profile':
          return {
            title: 'Complete Profile Required',
            message: 'Please complete your player profile before creating a team. Make sure to fill in all required fields.',
            actions: [
              <Button key="profile" asChild className="bg-primary hover:bg-primary/90">
                <Link href="/setup-profile">Complete Profile</Link>
              </Button>,
              <Button key="home" asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            ]
          }
        case 'already_in_team':
          return {
            title: 'Already in a Team',
            message: 'You are already in a team and cannot create a new team. Each player can only be in one team at a time.',
            actions: [
              <Button key="team" asChild className="bg-primary hover:bg-primary/90">
                <Link href="/teams">View Your Team</Link>
              </Button>,
              <Button key="home" asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            ]
          }
        case 'already_created_team':
          return {
            title: 'Team Already Created',
            message: 'You have already created a team and cannot create another. Each player can only create one team.',
            actions: [
              <Button key="team" asChild className="bg-primary hover:bg-primary/90">
                <Link href="/teams">View Your Team</Link>
              </Button>,
              <Button key="home" asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            ]
          }
        default:
          return {
            title: 'Cannot Create Team',
            message: 'You are unable to create a team at this time.',
            actions: [
              <Button key="home" asChild variant="outline">
                <Link href="/">Back to Home</Link>
              </Button>
            ]
          }
      }
    }

    const errorContent = getErrorContent()

    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="bg-card border-border p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🚫</div>
              <h2 className="text-3xl font-bold mb-4">{errorContent.title}</h2>
              <p className="text-muted-foreground mb-8">
                {errorContent.message}
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                {errorContent.actions}
              </div>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="bg-card border-border p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-bold mb-4">Team Created!</h2>
              <p className="text-muted-foreground mb-8">
                Your team has been successfully created. You can now invite players and manage your roster.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button asChild className="bg-primary hover:bg-primary/90">
                  <Link href="/teams">View All Teams</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/search">Search for Players</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8">Create a Team</h1>

        <Card className="bg-card border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Team Name */}
            <div>
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your team name"
                required
                className="bg-input border-border"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your team..."
                rows={4}
                className="bg-input border-border resize-none"
              />
            </div>

            {/* Team Size */}
            <div>
              <Label htmlFor="team_size">Team Size *</Label>
              <Select value={formData.team_size} onValueChange={(value: '5' | '6') => setFormData(prev => ({ ...prev, team_size: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Players (Main Roster)</SelectItem>
                  <SelectItem value="6">6 Players (5 + Sub)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {formData.team_size === '5' ? 'Standard 5-player team' : '5 players + 1 substitute'}
              </p>
            </div>

            {/* Open Positions */}
            <div>
              <Label>Open Positions (Roles you're looking for)</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                {ROLES.map(role => (
                  <Button
                    key={role}
                    type="button"
                    variant={formData.open_positions.includes(role) ? 'default' : 'outline'}
                    onClick={() => handleRoleToggle(role)}
                    className="text-sm"
                  >
                    {role}
                  </Button>
                ))}
              </div>
              {formData.open_positions.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Select roles if you're looking for players
                </p>
              )}
            </div>

            {/* Recruiting Status */}
            <div>
              <Label htmlFor="recruiting_status">Recruiting Status *</Label>
              <Select value={formData.recruiting_status} onValueChange={(value: 'Open' | 'Closed' | 'Full') => setFormData(prev => ({ ...prev, recruiting_status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open - Looking for players</SelectItem>
                  <SelectItem value="Closed">Closed - Not recruiting</SelectItem>
                  <SelectItem value="Full">Full - Team complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? 'Creating Team...' : 'Create Team'}
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/teams">Cancel</Link>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}
