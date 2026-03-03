'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import RoleIcon from '@/components/RoleIcon'
import RoleSelect from '@/components/RoleSelect'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { Shield, Trophy, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

const getTierColor = (tier: string | null) => {
  if (!tier) return 'bg-gray-500'
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
    main_role: '',
    secondary_role: '',
    looking_for_team: true
  })
  const [riotError, setRiotError] = useState<string | null>(null)
  const [fetchedTier, setFetchedTier] = useState<string | null>(null)
  const [profileIconId, setProfileIconId] = useState<number>(29)

  // Ownership Verification State
  const [verificationRequired, setVerificationRequired] = useState<{
    expectedIconId: number;
    currentIconId: number;
    summonerName: string;
  } | null>(null)

  useEffect(() => {
    // Load existing profile if it exists (auth is handled by middleware)
    const loadExistingProfile = async () => {
      try {
        const supabase = createClient()

        // Get current session first
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !sessionData?.session?.user) {
          return
        }

        const user = sessionData.session.user
        setUserId(user.id)

        // Check if user already has a profile
        const { data: existingProfile, error: profileError } = await supabase
          .from('players')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          // Error handling
        }

        if (existingProfile) {
          // Profile exists, load for editing
          setFormData({
            summoner_name: existingProfile.summoner_name || '',
            main_role: existingProfile.main_role || '',
            secondary_role: existingProfile.secondary_role || '',
            looking_for_team: existingProfile.looking_for_team || false
          })
          setFetchedTier(existingProfile.tier || null)
          setProfileIconId(existingProfile.profile_icon_id || 29)
          setIsEditing(true)

          // Fetch team information if player is in a team
          if (existingProfile.team_id) {
            const { data: teamData, error: teamError } = await supabase
              .from('teams')
              .select('*')
              .eq('id', existingProfile.team_id)
              .single()

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
        // Error handling
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
    setRiotError(null)

    if (!formData.main_role) {
      setRiotError("Please select a Main Role")
      return;
    }

    if (!formData.secondary_role) {
      setRiotError("Please select a Secondary Role")
      return;
    }

    setLoading(true)

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

        if (errorData.requiresVerification) {
          setProfileIconId(errorData.currentIconId || 29)
          setVerificationRequired({
            expectedIconId: errorData.expectedIconId,
            currentIconId: errorData.currentIconId,
            summonerName: errorData.summonerName
          });
          setRiotError(errorData.error);
        } else {
          let errorMessage = errorData.error;
          if (errorData.error === 'Validation error' && errorData.details?.length > 0) {
            errorMessage = errorData.details[0].message;
          }

          setRiotError(errorMessage || 'Failed to save profile')
          setVerificationRequired(null)
        }
      }
    } catch (error) {
      setRiotError('An unexpected error occurred')
      setVerificationRequired(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen pt-24 pb-12 bg-background text-white font-beaufort">
      <div className="max-w-6xl mx-auto px-4">
        {/* League Client Styled Header */}
        <div className="relative mb-12 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
            <h1 className="text-2xl md:text-3xl font-beaufort font-black uppercase tracking-[0.5em] text-[#c9aa71] drop-shadow-2xl">
              {isEditing ? 'Edit Profile' : 'Complete Profile'}
            </h1>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9aa71]/50 to-transparent"></div>
          </div>
          <div className="flex items-center justify-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400">
              {isEditing ? 'UPDATE YOUR CHAMPION DATA' : 'FORGE YOUR LEGEND IN THE ARENA'}
            </span>
            <div className="w-1 h-1 rotate-45 bg-[#c9aa71]"></div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto">

          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Left Column: Form Content */}
            <div className="w-full lg:w-3/5 space-y-8">
              <div className="bg-[#0c121d]/60 border border-slate-800/60 rounded-xl p-8 backdrop-blur-xl shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all duration-300">

                {/* Team Info (if applicable) */}
                {userTeam && (
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between group transition-all hover:bg-cyan-500/10 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center p-1">
                        {getTeamAvatarUrl(userTeam.team_avatar) ? (
                          <img
                            src={getTeamAvatarUrl(userTeam.team_avatar) || ''}
                            alt={`${userTeam.name} logo`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-cyan-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-cyan-500/60 uppercase tracking-widest font-bold mb-0.5">Assigned Squad</p>
                        <p className="text-white font-bold tracking-wide">{userTeam.name}</p>
                      </div>
                    </div>
                    <Link
                      href={`/teams/${userTeam.id}`}
                      className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest hover:text-cyan-300 transition-colors"
                    >
                      {userTeam.captain_id === userId ? 'Manage' : 'View'}
                    </Link>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-5">
                    {/* Riot ID Input */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] ml-1">
                        Riot ID <span className="text-[#c9aa71] ml-1 text-base leading-none align-middle">*</span>
                      </label>
                      <div className="relative group">
                        <Input
                          type="text"
                          name="summoner_name"
                          value={formData.summoner_name}
                          onChange={handleChange}
                          placeholder="GameName#TagLine"
                          required
                          className="h-12 bg-[#0c121d]/60 border-slate-800/60 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-xl px-4 transition-all hover:border-slate-700"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                          <Zap className="w-4 h-4 text-cyan-500" />
                        </div>
                      </div>

                      {/* Error State */}
                      {riotError && !verificationRequired && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{riotError}</div>
                        </div>
                      )}

                      {/* Verification Required */}
                      {verificationRequired && (
                        <div className="mt-4 p-5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4">
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-amber-500" />
                            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Verification Required</h4>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wider">
                            Change your LoL client profile icon to match the one below, wait 30s, and submit again.
                          </p>
                          <div className="flex items-center justify-center gap-8 py-2">
                            <div className="text-center">
                              <p className="text-[8px] text-slate-500 font-bold uppercase mb-2">TARGET ICON</p>
                              <img
                                src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${verificationRequired.expectedIconId}.png`}
                                alt="Expected"
                                className="w-16 h-16 rounded-xl border-2 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                              />
                            </div>
                            <div className="text-center opacity-30">
                              <p className="text-[8px] text-slate-500 font-bold uppercase mb-2">CURRENT</p>
                              <img
                                src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${verificationRequired.currentIconId}.png`}
                                alt="Current"
                                className="w-12 h-12 rounded-xl border border-slate-700"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Roles Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em] ml-1">
                          Role Main <span className="text-[#c9aa71] ml-1 text-base leading-none align-middle">*</span>
                        </label>
                        <RoleSelect
                          value={formData.main_role}
                          onChange={(value) => setFormData({ ...formData, main_role: value })}
                          placeholder="Primary Role"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 uppercase tracking-[0.2em] ml-1">
                          Role Secondary <span className="text-[#c9aa71] ml-1 text-base leading-none align-middle">*</span>
                        </label>
                        <RoleSelect
                          value={formData.secondary_role}
                          onChange={(value) => setFormData({ ...formData, secondary_role: value })}
                          placeholder="Alternate Role"
                          required
                        />
                      </div>
                    </div>

                    {/* LFT Toggle */}
                    <div className="flex items-center gap-3 py-2">
                      <div
                        className={`w-10 h-6 p-1 rounded-full cursor-pointer transition-all duration-300 relative ${formData.looking_for_team ? 'bg-cyan-500/30' : 'bg-slate-800'}`}
                        onClick={() => setFormData(prev => ({ ...prev, looking_for_team: !prev.looking_for_team }))}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${formData.looking_for_team ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">Looking for squad invitations</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-[10px] font-black uppercase tracking-[0.2em] h-12 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5 hover:text-cyan-400 transition-all rounded-md bg-[#0c121d]/60 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (isEditing ? 'TRANSITIONING...' : 'INITIALIZING...') : (isEditing ? 'COMMIT PROFILE' : 'COMMIT PROFILE')}
                  </button>
                </form>
              </div>
            </div>

              {/* Right Column: Visual Preview */}
              <div className="hidden lg:flex w-2/5 flex-col justify-center items-center h-full self-stretch border-l border-slate-800/50 pl-12 space-y-8">
                <div className="relative group w-full max-w-[280px]">
                  {/* Hextech Frame Around Preview Card */}
                  <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500/20 to-transparent rounded-2xl blur-sm opacity-50 transition-opacity group-hover:opacity-100" />

                  <div className="relative bg-[#0c121d]/60 border border-slate-800/60 rounded-xl p-6 space-y-6 backdrop-blur-xl shadow-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all duration-300">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {/* Avatar Preview */}
                      <div className="relative">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#c9aa71]/30 p-1 bg-[#0c121d]/60">
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/15.23.1/img/profileicon/${profileIconId || 29}.png`}
                            alt="Avatar"
                            className="w-full h-full object-cover rounded-xl opacity-60 group-hover:opacity-100 transition-opacity"
                          />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-[#0c121d]/60 border border-slate-800/60 p-1.5 rounded-lg shadow-lg">
                          {formData.main_role ? (
                            <RoleIcon role={formData.main_role} size={20} className="brightness-150" />
                          ) : (
                            <Trophy className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 w-full overflow-hidden">
                        <h3 className="text-xl font-bold font-beaufort text-white tracking-widest truncate uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
                          {formData.summoner_name || 'NO NAME'}
                        </h3>
                        <div className="flex items-center justify-center gap-2">
                          {fetchedTier ? (
                            <Badge className={`${getTierColor(fetchedTier)} text-white text-[8px] font-bold uppercase tracking-tight py-0.5 px-2 rounded-sm h-auto shadow-[0_0_8px_rgba(0,0,0,0.3)]`}>
                              {fetchedTier}
                            </Badge>
                          ) : (
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">UNRANKED</span>
                          )}
                          <div className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                            {formData.main_role || 'ROLE TBD'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

                    <div className="flex justify-center">
                      {formData.looking_for_team ? (
                        <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(34,211,238,0.1)] flex items-center gap-2 animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          LFT Status Active
                        </div>
                      ) : (
                        <div className="px-4 py-1.5 rounded-full bg-[#0c121d]/60 border border-slate-800/60 text-slate-500 text-[9px] font-bold uppercase tracking-[0.2em]">
                          Private Profile
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-w-[280px] w-full p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[#c89b3c] text-[8px] font-bold uppercase tracking-wider">Public Disclaimer</div>
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider leading-relaxed">
                    All profile data provided is indexed for public recruitment and tournament qualification.
                  </p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
