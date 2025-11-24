'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Trophy, Users, Zap } from 'lucide-react'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster']

const getTierColor = (tier: string) => {
  const colors: { [key: string]: string } = {
    'Iron': 'bg-gray-500',
    'Bronze': 'bg-orange-700',
    'Silver': 'bg-gray-400',
    'Gold': 'bg-yellow-500',
    'Platinum': 'bg-green-500',
    'Diamond': 'bg-blue-500',
    'Master': 'bg-purple-500',
    'Grandmaster': 'bg-red-500'
  }
  return colors[tier] || 'bg-gray-500'
}

const getRoleIcon = (role: string) => {
  const icons: { [key: string]: string } = {
    'Top': '🛡️',
    'Jungle': '🌳',
    'Mid': '✨',
    'ADC': '🏹',
    'Support': '💙'
  }
  return icons[role] || '❓'
}

export default function SetupProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    summoner_name: '',
    discord: '',
    main_role: '',
    secondary_role: '',
    tier: '',
    opgg_link: '',
    looking_for_team: true
  })

  useEffect(() => {
    // Load existing profile if it exists (auth is handled by middleware)
    const loadExistingProfile = async () => {
      try {
        // Get current user
        const authResponse = await fetch('/api/auth/user')
        if (authResponse.ok) {
          const { user } = await authResponse.json()
          setUserId(user.id)
          
          // Check if user already has a profile
          const profileResponse = await fetch(`/api/players/${user.id}`)
          if (profileResponse.ok) {
            const existingProfile = await profileResponse.json()
            // Load existing profile data for editing
            setFormData({
              summoner_name: existingProfile.summoner_name || '',
              discord: existingProfile.discord || '',
              main_role: existingProfile.main_role || '',
              secondary_role: existingProfile.secondary_role || '',
              tier: existingProfile.tier || '',
              opgg_link: existingProfile.opgg_link || '',
              looking_for_team: existingProfile.looking_for_team || false
            })
            setIsEditing(true)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const endpoint = isEditing ? `/api/players/${userId}` : '/api/players'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.push('/dashboard')
      } else {
        const error = await response.json()
        console.error(`Error ${isEditing ? 'updating' : 'creating'} profile:`, error)
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} profile:`, error)
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
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <p className="text-purple-200 text-sm">
                      {isEditing ? 'Update your information below' : 'Complete your profile to access all tournament features'}
                    </p>
                    <p className="text-purple-300 text-xs mt-2">
                      All fields are required except OP.GG URL
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Summoner Name *
                    </label>
                    <Input
                      type="text"
                      name="summoner_name"
                      value={formData.summoner_name}
                      onChange={handleChange}
                      placeholder="Your in-game name"
                      required
                      className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                    />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Main Role *
                    </label>
                    <select
                      name="main_role"
                      value={formData.main_role}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                    >
                      <option value="">Select Main Role</option>
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {getRoleIcon(role)} {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Secondary Role *
                    </label>
                    <select
                      name="secondary_role"
                      value={formData.secondary_role}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                    >
                      <option value="">Select Secondary Role</option>
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {getRoleIcon(role)} {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rank */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Rank *
                  </label>
                  <select
                    name="tier"
                    value={formData.tier}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  >
                    <option value="">Select Rank</option>
                    {TIERS.map(tier => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </div>

                {/* OP.GG Link */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    OP.GG Profile URL (Optional)
                  </label>
                  <Input
                    type="url"
                    name="opgg_link"
                    value={formData.opgg_link}
                    onChange={handleChange}
                    placeholder="https://op.gg/..."
                    className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                  />
                  <p className="text-purple-300 text-xs mt-1">
                    Help teams verify your rank and gameplay
                  </p>
                </div>

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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-400">
                            {formData.summoner_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white">{formData.summoner_name}</div>
                          <div className="text-sm text-gray-400">{formData.discord}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {formData.main_role && (
                          <span title={formData.main_role}>{getRoleIcon(formData.main_role)}</span>
                        )}
                        {formData.tier && (
                          <Badge className={`${getTierColor(formData.tier)} text-white text-xs`}>
                            {formData.tier}
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
