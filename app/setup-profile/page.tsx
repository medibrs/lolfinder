'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import RoleIcon from '@/components/RoleIcon'
import RoleSelect from '@/components/RoleSelect'
import { Shield, Trophy, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger', 'Unranked']

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

export default function SetupProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userTeam, setUserTeam] = useState<any>(null)
  const [formData, setFormData] = useState({
    summoner_name: '',
    discord: '',
    main_role: '',
    secondary_role: '',
    looking_for_team: true
  })
  const [riotError, setRiotError] = useState<string | null>(null)
  const [fetchedTier, setFetchedTier] = useState<string | null>(null)

  useEffect(() => {
    // Load existing profile if it exists (auth is handled by middleware)
    const loadExistingProfile = async () => {
      try {
        const supabase = createClient()
        
        // Get current session first
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        
        if (sessionError || !sessionData?.session?.user) {
          console.error('No authenticated session found:', sessionError)
          return
        }
        
        const user = sessionData.session.user
        setUserId(user.id)
        
        // Check if user already has a profile
        const { data: existingProfile, error: profileError } = await supabase
          .from('players')
          .select('*')
          .eq('id', user.id)
          .maybeSingle() // Use maybeSingle() instead of single() to handle 0 rows
          
        if (profileError) {
          console.error('Profile error details:', profileError)
        }
        
        if (existingProfile) { // Check if profile exists (no error check needed with maybeSingle)
          // Profile exists, load for editing
          setFormData({
            summoner_name: existingProfile.summoner_name || '',
            discord: existingProfile.discord || '',
            main_role: existingProfile.main_role || '',
            secondary_role: existingProfile.secondary_role || '',
            looking_for_team: existingProfile.looking_for_team || false
          })
          setFetchedTier(existingProfile.tier || null)
          setIsEditing(true)

          // Fetch team information if player is in a team
          if (existingProfile.team_id) {
            // Verify the user is actually in this team
            const { data: teamData, error: teamError } = await supabase
              .from('teams')
              .select('*')
              .eq('id', existingProfile.team_id)
              .single()
            
            // Double-check by verifying there's a player record with this team_id
            if (!teamError && teamData) {
              const { data: verifyMember } = await supabase
                .from('players')
                .select('id')
                .eq('id', user.id)
                .eq('team_id', existingProfile.team_id)
                .single()
              
              if (verifyMember) {
                setUserTeam(teamData)
              } else {
                // User is not actually in this team, clear the team_id
                await supabase
                  .from('players')
                  .update({ team_id: null })
                  .eq('id', user.id)
                setUserTeam(null)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }
    loadExistingProfile()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
    }))
  }

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave your team?')) {
      return
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/teams/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        setUserTeam(null)
        // Reload profile to update team_id
        window.location.reload()
      } else {
        const error = await response.json()
        console.error('Error leaving team:', error.error)
      }
    } catch (error) {
      console.error('Error leaving team:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setRiotError(null)

    try {
      const endpoint = isEditing ? `/api/players/${userId}` : '/api/players'
      const method = isEditing ? 'PUT' : 'POST'
      
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.push('/')
      } else {
        const errorData = await response.json()
        console.error(`Error ${isEditing ? 'updating' : 'creating'} profile:`, errorData)
        // Show Riot API validation errors to the user
        setRiotError(errorData.error || 'Failed to save profile')
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} profile:`, error)
      setRiotError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pt-20">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Card className="bg-gray-900/90 backdrop-blur-sm border-purple-500/20 shadow-2xl">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-3xl font-bold text-white">
                {isEditing ? 'Edit Your Profile' : 'Complete Your Profile'}
              </CardTitle>
              <CardDescription className="text-purple-200">
                {isEditing ? 'Update your League of Legends player profile' : 'Complete your League of Legends player profile to access all features'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Information */}
              {userTeam && (
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">Team Status</h3>
                      <p className="text-purple-200">
                        You are a member of <span className="font-bold text-white">{userTeam.name}</span>
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="border-purple-500 text-purple-400 hover:bg-purple-500/20"
                    >
                      <Link href={`/teams/${userTeam.id}`}>
                        {userTeam.captain_id === userId ? 'Manage Team' : 'View Team'}
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <p className="text-purple-200 text-sm">
                      {isEditing ? 'Update your information below' : 'Complete your profile to access all tournament features'}
                    </p>
                    <p className="text-purple-300 text-xs mt-2">
                      All fields are required. Rank and OP.GG are auto-fetched from Riot API.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Riot ID *
                    </label>
                    <Input
                      type="text"
                      name="summoner_name"
                      value={formData.summoner_name}
                      onChange={handleChange}
                      placeholder="GameName#TagLine (e.g., Player#EUW)"
                      required
                      className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                    />
                    <p className="text-xs text-gray-400 mt-1">Enter your Riot ID in the format: GameName#TagLine</p>
                    {riotError && (
                      <p className="text-xs text-red-400 mt-1">{riotError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Discord Username *
                    </label>
                    <Input
                      type="text"
                      name="discord"
                      value={formData.discord}
                      onChange={handleChange}
                      placeholder="Username#1234"
                      required
                      className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Roles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Main Role *
                    </label>
                    <RoleSelect
                      value={formData.main_role}
                      onChange={(value) => setFormData({ ...formData, main_role: value })}
                      placeholder="Select Main Role"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Secondary Role *
                    </label>
                    <RoleSelect
                      value={formData.secondary_role}
                      onChange={(value) => setFormData({ ...formData, secondary_role: value })}
                      placeholder="Select Secondary Role"
                      required
                    />
                  </div>
                </div>

                {/* Rank Info - Auto-fetched */}
                {fetchedTier && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <p className="text-sm text-purple-200">
                      Current Rank: <Badge className={`${getTierColor(fetchedTier)} text-white text-xs ml-2`}>{fetchedTier}</Badge>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Rank and OP.GG link are automatically fetched from Riot API</p>
                  </div>
                )}

                {/* Looking for Team */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="looking_for_team"
                    name="looking_for_team"
                    checked={formData.looking_for_team}
                    onChange={handleChange}
                    className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="looking_for_team" className="text-sm font-medium text-purple-200">
                    I'm looking for a team
                  </label>
                </div>

                {/* Preview */}
                {formData.summoner_name && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-purple-200 mb-3">Profile Preview</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-purple-400">
                            {formData.summoner_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate">{formData.summoner_name}</div>
                          <div className="text-sm text-gray-400 truncate">{formData.discord}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {formData.main_role && (
                          <span title={formData.main_role}>
                            <RoleIcon role={formData.main_role} size={16} />
                          </span>
                        )}
                        {fetchedTier && (
                          <Badge className={`${getTierColor(fetchedTier)} text-white text-xs`}>
                            {fetchedTier}
                          </Badge>
                        )}
                        {formData.looking_for_team && (
                          <Badge 
                            variant="default" 
                            className="bg-green-500 text-xs cursor-help" 
                            title="Looking for team"
                          >
                            LFT
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Privacy Disclaimer */}
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-400 mt-0.5">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-yellow-200 font-semibold text-sm mb-1">Public Profile Information</h4>
                      <p className="text-yellow-100/80 text-xs">
                        All information you provide here will be publicly visible to other players, team captains, and tournament organizers. Only share information you're comfortable making public.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={loading}
                >
                  {loading ? (isEditing ? 'Updating Profile...' : 'Creating Profile...') : (isEditing ? 'Update Profile' : 'Complete Profile')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
