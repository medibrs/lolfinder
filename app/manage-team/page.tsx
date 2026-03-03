'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Shield, Trophy, Users, Zap, Settings, UserPlus, UserMinus, Crown, Trash2, AlertTriangle, Edit, MessageSquare, Upload, Plus, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getTeamAvatarUrl } from '@/components/ui/team-avatar'
import { getRankImage } from '@/lib/rank-utils'
import RoleIcon from '@/components/RoleIcon'
import { CurrentUserAvatar } from '@/components/current-user-avatar'

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] as const

export default function ManageTeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    open_positions: [] as string[],
    recruiting_status: 'Open' as 'Open' | 'Closed' | 'Full',
    team_size: 6,
    substitute_id: null as string | null
  })
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [updatingAvatar, setUpdatingAvatar] = useState(false)
  const [showCaptainTransfer, setShowCaptainTransfer] = useState(false)
  const [selectedNewCaptain, setSelectedNewCaptain] = useState<string | null>(null)
  const [transferringCaptain, setTransferringCaptain] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isTeamInActiveTournament, setIsTeamInActiveTournament] = useState(false)

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

      // Get team where user is captain using the view
      const { data: teamData, error: teamError } = await supabase
        .from('team_with_players')
        .select('*')
        .eq('captain_id', authUser.id)
        .single()

      if (teamError || !teamData) {
        router.push('/create-team')
        return
      }


      setTeam(teamData)

      // Always query players directly to get is_substitute field
      const { data: membersData, error: membersError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamData.id)

      setTeamMembers(membersData || [])

      // Find the substitute player from the queried members
      const substituteMember = membersData?.find((p: any) => p.is_substitute)

      setFormData({
        name: teamData.name,
        open_positions: teamData.open_positions || [],
        recruiting_status: teamData.recruiting_status,
        team_size: teamData.team_size || 6,
        substitute_id: substituteMember?.id || null
      })

      // Fetch pending join requests
      const { data: requestsData } = await supabase
        .from('team_join_requests')
        .select(`
          *,
          player:players(summoner_name, main_role, tier, discord)
        `)
        .eq('team_id', teamData.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      setJoinRequests(requestsData || [])

      // Fetch tournament registrations (only approved - check both 'approved' and legacy 'Confirmed')
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournament_registrations')
        .select(`
          *,
          tournament:tournaments(*)
        `)
        .eq('team_id', teamData.id)
        .in('status', ['approved', 'Confirmed'])
        .order('registered_at', { ascending: false })


      // Also check ALL registrations for debugging
      const { data: allRegistrations } = await supabase
        .from('tournament_registrations')
        .select('id, status, tournament_id')
        .eq('team_id', teamData.id)


      setTournaments(tournamentsData || [])

      // Check if team is in an active tournament (Current time is between start and end date)
      const now = new Date()
      const inActive = tournamentsData?.some(reg => {
        const tournament = reg.tournament as any
        if (!tournament) return false
        const start = new Date(tournament.start_date)
        const end = new Date(tournament.end_date)
        return now >= start && now <= end
      })
      setIsTeamInActiveTournament(!!inActive)

    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const handleSaveTeam = async () => {
    try {
      const supabase = createClient()

      const updateResponse = await fetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          open_positions: formData.open_positions,
          recruiting_status: formData.recruiting_status,
          team_size: String(formData.team_size),
        }),
      })

      if (!updateResponse.ok) {
        const result = await updateResponse.json()
        alert(result.error || 'Failed to update team')
        return
      }

      // Handle avatar upload if pending
      if (pendingAvatarFile) {
        setUpdatingAvatar(true)
        const { data: { session } } = await supabase.auth.getSession()
        const uploadFormData = new FormData()
        uploadFormData.append('file', pendingAvatarFile)
        uploadFormData.append('teamId', team.id)

        const uploadResponse = await fetch('/api/teams/upload-avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: uploadFormData,
        })
        if (!uploadResponse.ok) {
          const result = await uploadResponse.json()
          alert(result.error || 'Failed to update avatar')
        }
        setPendingAvatarFile(null)
        setAvatarPreview(null)
      }

      // Update substitute status for all players

      // First, remove substitute status from all players
      const { error: clearError } = await supabase
        .from('players')
        .update({ is_substitute: false })
        .eq('team_id', team.id)

      if (clearError) {

      }

      // Then set the selected player as substitute (if any)
      if (formData.substitute_id) {
        const { error: setError } = await supabase
          .from('players')
          .update({ is_substitute: true })
          .eq('id', formData.substitute_id)

        if (setError) {

        } else {
        }
      }

      setEditing(false)
      window.dispatchEvent(new Event('team-updated'))
      loadTeamData() // Refresh data
    } catch (error) {

    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !team || isTeamInActiveTournament) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2MB");
      if (event.target) event.target.value = '';
      return;
    }

    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));

    // Reset file input value so same file can be picked again
    if (event.target) {
      event.target.value = '';
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const supabase = createClient()

      // Get the player's name before removing
      const { data: playerData } = await supabase
        .from('players')
        .select('summoner_name')
        .eq('id', memberId)
        .single()

      // Remove member from team
      const { error } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('id', memberId)

      if (error) {

        return
      }

      // Delete any pending invitations for this player from this team
      await supabase
        .from('team_invitations')
        .delete()
        .eq('team_id', team.id)
        .eq('invited_player_id', memberId)
        .eq('status', 'pending')

      // Delete any pending join requests from this player to this team
      await supabase
        .from('team_join_requests')
        .delete()
        .eq('team_id', team.id)
        .eq('player_id', memberId)
        .eq('status', 'pending')

      // Send notification to the removed player
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: memberId,
          type: 'team_member_removed',
          title: `Removed from ${team.name}`,
          message: `You have been removed from ${team.name} by the team captain.`,
          data: {
            team_id: team.id,
            team_name: team.name
          }
        }])

      if (notificationError) {

      } else {
      }

      window.dispatchEvent(new Event('team-updated'))
      loadTeamData() // Refresh data
    } catch (error) {

    }
  }

  const handleJoinRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`/api/team-join-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        window.dispatchEvent(new Event('team-updated'))
        loadTeamData() // Refresh data
      } else {
        const error = await response.json()
        // Only log if it's not the "already processed" error
        if (error.error !== 'Join request not found or already processed') {

        } else {
          // Request was already processed, just refresh
          loadTeamData()
        }
      }
    } catch (error) {

    }
  }

  const handleRoleToggle = (role: string) => {
    setFormData(prev => ({
      ...prev,
      open_positions: prev.open_positions.includes(role)
        ? prev.open_positions.filter(r => r !== role)
        : [...prev.open_positions, role]
    }))
  }

  const handleDeleteTeam = async () => {
    if (!confirm('Are you sure you want to delete your team? This action cannot be undone and will remove all team members.')) {
      return
    }

    try {
      const supabase = createClient()

      // Get all team members (excluding captain) to notify them
      const { data: members } = await supabase
        .from('players')
        .select('id, summoner_name')
        .eq('team_id', team.id)
        .neq('id', user.id)  // Exclude captain

      // Send notifications to all team members
      if (members && members.length > 0) {
        const notifications = members.map(member => ({
          user_id: member.id,
          type: 'team_member_removed',
          title: `${team.name} has been disbanded`,
          message: `The team captain has disbanded ${team.name}. You are now a free agent.`,
          data: {
            team_id: team.id,
            team_name: team.name
          }
        }))

        await supabase
          .from('notifications')
          .insert(notifications)
      }

      // Remove all team members (set team_id to null)
      const { error: memberError } = await supabase
        .from('players')
        .update({ team_id: null, looking_for_team: true })
        .eq('team_id', team.id)

      if (memberError) {

        return
      }

      // Delete the team
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (teamError) {

        return
      }

      window.dispatchEvent(new Event('team-updated'))
      // Redirect to home after successful deletion
      router.push('/')
    } catch (error) {

    }
  }

  const handleTransferCaptain = async () => {
    if (!selectedNewCaptain || !team) return

    try {
      setTransferringCaptain(true)
      const supabase = createClient()

      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captain_id: selectedNewCaptain }),
      })

      if (response.ok) {
        setShowCaptainTransfer(false)
        setSelectedNewCaptain(null)
        window.dispatchEvent(new Event('team-updated'))
        // Route former captain to view team page since they're no longer captain
        router.push(`/teams/${team.id}`)
      } else {
        const errorData = await response.json()

      }
    } catch (error) {

    } finally {
      setTransferringCaptain(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-4">Loading Team Data</h2>
          </div>
        </div>
      </main>
    )
  }

  if (!team) {
    return (
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="bg-card border-border p-8">
            <div className="text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-3xl font-bold mb-4">No Team Found</h2>
              <p className="text-muted-foreground mb-8">
                You don't have a team to manage. Create one first!
              </p>
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link href="/create-team">Create Team</Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-500" />
                Manage Team
              </h1>
              <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 ml-1">
                <span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> {teamMembers.length}/{team.team_size || 6} Members</span>
                <span className="w-1 h-1 rounded-full bg-slate-800" />
                <span>Est. {new Date(team.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button asChild variant="ghost" className="w-full sm:w-auto border border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400">
                <Link href="/team-chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Team Chat
                </Link>
              </Button>
              <Button asChild variant="ghost" className="w-full sm:w-auto border border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400">
                <Link href="/teams">Back to Teams</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            As team captain, you can manage your team settings and members
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Settings */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Team Settings
                  </CardTitle>
                  <Button
                    onClick={() => setEditing(!editing)}
                    variant="ghost"
                    className={`border transition-all ${editing 
                      ? "border-slate-800 text-slate-500 hover:bg-slate-800/50" 
                      : "border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400"}`}
                  >
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-300">Team Name</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => {
                          const filtered = e.target.value.replace(/[^a-zA-Z0-9\s\-_!@#$%^&*(),.?':;]/g, '')
                          setFormData(prev => ({ ...prev, name: filtered }))
                        }}
                        placeholder="Enter team name"
                        maxLength={25}
                        className="bg-slate-900/50 border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus-visible:ring-cyan-500 transition-all text-slate-200"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Choose your team name wisely and respectfully (max 25 characters). Inappropriate or offensive names will be rejected. Team names must be in English.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3 text-slate-300">Team Avatar</label>
                      <div className="flex items-center gap-6">
                        <div className="relative group">
                          {/* Avatar Container */}
                          <div className={`w-24 h-24 rounded-lg overflow-hidden border-2 transition-all duration-300 bg-slate-900 flex items-center justify-center ${
                            isTeamInActiveTournament 
                              ? 'border-orange-500/30' 
                              : 'border-slate-700 group-hover:border-cyan-500 shadow-lg group-hover:shadow-cyan-500/20'
                          }`}>
                            {(avatarPreview || team?.team_avatar) ? (
                              <img 
                                src={avatarPreview || getTeamAvatarUrl(team.team_avatar) || ''} 
                                alt="Team Avatar" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <Shield className="w-10 h-10 text-slate-700 group-hover:text-slate-500 transition-colors" />
                            )}
                            
                            {/* Hover Overlay */}
                            {!isTeamInActiveTournament && (
                              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                <div className="flex flex-col items-center gap-1">
                                  <Pencil className="w-6 h-6 text-cyan-400" />
                                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Change</span>
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileUpload}
                                  disabled={updatingAvatar}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>

                          {/* Locked Status Indicator */}
                          {isTeamInActiveTournament && (
                            <div className="absolute -bottom-2 -right-2 bg-orange-500 rounded-full p-1 border-2 border-slate-950">
                              <Trophy className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          {isTeamInActiveTournament ? (
                            <div className="p-3 rounded border border-orange-500/20 bg-orange-500/5">
                              <p className="text-xs font-bold text-orange-400 uppercase tracking-tight flex items-center gap-2">
                                <Trophy className="w-3 h-3" />
                                Locked during tournament
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                Logo changes are disabled during active competition.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs text-slate-400 font-medium">Click emblem to upload new insignia</p>
                              <p className="text-[10px] text-slate-600 uppercase tracking-widest leading-relaxed">
                                PNG, JPG (Max 2MB)
                              </p>
                              {pendingAvatarFile && (
                                <p className="text-[10px] text-emerald-400 font-bold uppercase animate-pulse">
                                  Pending: {pendingAvatarFile.name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3 text-slate-300">Looking For</label>
                      <div className="flex flex-wrap gap-3">
                        {ROLES.map(role => (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleRoleToggle(role)}
                            className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-md border transition-all duration-200 ${
                              formData.open_positions.includes(role)
                                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                            }`}
                            title={role}
                          >
                            <div className={`transition-all duration-200 ${
                              formData.open_positions.includes(role) 
                                ? 'text-cyan-400 scale-110' 
                                : 'text-slate-500 group-hover:text-slate-300'
                            }`}>
                              <RoleIcon role={role} size={24} />
                            </div>
                            {formData.open_positions.includes(role) && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-slate-300">Recruiting Status</label>
                        <select
                          value={formData.recruiting_status}
                          onChange={(e) => setFormData(prev => ({ ...prev, recruiting_status: e.target.value as any }))}
                          className="w-full p-2 border rounded-md bg-slate-900/50 border-slate-700 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                        >
                          <option value="Open">Open</option>
                          <option value="Closed">Closed</option>
                          <option value="Full">Full</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-slate-300">Team Size</label>
                        <select
                          value={formData.team_size}
                          onChange={(e) => setFormData(prev => ({ ...prev, team_size: parseInt(e.target.value) }))}
                          className="w-full p-2 border rounded-md bg-slate-900/50 border-slate-700 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                          disabled={teamMembers.length > 5}
                        >
                          <option value={5}>5 (No Sub)</option>
                          <option value={6}>6 (With Sub)</option>
                        </select>
                        {teamMembers.length > 5 && (
                          <p className="text-xs text-slate-500 mt-1">
                            Cannot reduce size while you have {teamMembers.length} members
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Substitute Selection - Only show if team has 6 members */}
                    {teamMembers.length === 6 && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-slate-300">Substitute Player</label>
                        <select
                          value={formData.substitute_id || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, substitute_id: e.target.value || null }))}
                          className="w-full p-2 border rounded-md bg-slate-900/50 border-slate-700 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all outline-none"
                        >
                          <option value="">No Substitute</option>
                          {teamMembers
                            .filter(member => member.id !== team.captain_id)
                            .map(member => (
                              <option key={member.id} value={member.id}>
                                {member.summoner_name} ({member.main_role})
                              </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                          Select which player will be the substitute
                        </p>
                      </div>
                    )}

                    <Button 
                      onClick={handleSaveTeam} 
                      className="w-full bg-[#C89B3C] hover:bg-[#A67E22] text-zinc-900 font-bold shadow-[0_0_15px_rgba(200,155,60,0.2)] uppercase tracking-wider"
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-semibold">{team.name}</h3>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2 text-slate-300">Looking For:</p>
                      <div className="flex flex-wrap gap-2">
                        {team.open_positions?.length > 0 ? (
                          team.open_positions.map((role: string) => (
                            <Badge 
                              key={role} 
                              variant="secondary"
                              className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold"
                            >
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge 
                            variant="outline"
                            className="text-slate-500 border-slate-800 bg-slate-900/50 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold"
                          >
                            Not recruiting
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-slate-300 mb-2">Status:</p>
                      <Badge
                        className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                          team.recruiting_status === 'Open' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-900/50 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {team.recruiting_status}
                      </Badge>
                    </div>
                  </div>
                )}
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
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center group-hover:border-cyan-500/50 transition-colors">
                            <img
                              src={`https://ddragon.leagueoflegends.com/cdn/16.4.1/img/profileicon/${member.profile_icon_id || 29}.png`}
                              alt="Summoner Icon"
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded bg-slate-950 border border-slate-800 p-0.5 shadow-lg">
                            <Image
                              src={getRankImage(member.tier)}
                              alt={member.tier}
                              width={20}
                              height={20}
                              className="object-contain"
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 ml-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-200 truncate" title={member.summoner_name}>
                              {member.summoner_name.split('#')[0]}
                            </p>
                            {member.id === team.captain_id && (
                              <Badge className="border border-yellow-500 bg-yellow-500/10 text-yellow-400 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm">
                                <Crown className="w-3 h-3 mr-1" />
                                Captain
                              </Badge>
                            )}
                            {member.is_substitute && (
                              <Badge className="border border-cyan-500 bg-cyan-500/10 text-cyan-400 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm">
                                Sub
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-tight">
                            <RoleIcon role={member.main_role} size={14} className="brightness-75" />
                            <span>{member.main_role}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-800" />
                            <span className="text-cyan-600/80">{member.tier}</span>
                          </div>
                        </div>
                      </div>
                      {member.id !== team.captain_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-slate-800 text-slate-500 hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 transition-all"
                          onClick={() => setMemberToRemove({ id: member.id, name: member.summoner_name })}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {teamMembers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No team members yet. Invite players to join your team!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Join Requests */}
            {joinRequests.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Join Requests ({joinRequests.length})
                  </CardTitle>
                  <CardDescription>Players requesting to join your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {joinRequests.map((request: any) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{request.player?.summoner_name || 'Unknown Player'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{request.player?.main_role || 'No role'}</span>
                            <span>•</span>
                            <span>{request.player?.tier || 'Unranked'}</span>
                          </div>
                          {request.message && (
                            <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleJoinRequestAction(request.id, 'accept')}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleJoinRequestAction(request.id, 'reject')}
                            size="sm"
                            variant="outline"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full bg-[#C89B3C] hover:bg-[#A67E22] text-zinc-900 font-bold shadow-[0_0_15px_rgba(200,155,60,0.2)] uppercase tracking-wider">
                  <Link href="/players">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Find Players
                  </Link>
                </Button>

                <Button asChild variant="ghost" className="w-full border border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400">
                  <Link href="/teams">
                    <Users className="w-4 h-4 mr-2" />
                    Browse Teams
                  </Link>
                </Button>

                <Button
                  onClick={handleDeleteTeam}
                  variant="ghost"
                  className="w-full border border-slate-800 text-slate-500 hover:bg-red-900/20 hover:border-red-500 hover:text-red-400 transition-all duration-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Team
                </Button>

                <Button
                  onClick={() => setShowCaptainTransfer(true)}
                  variant="ghost"
                  className="w-full border border-slate-700 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500 hover:text-cyan-400"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Transfer Captain
                </Button>
              </CardContent>
            </Card>

            {/* Tournament Registrations */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Tournaments ({tournaments.length})
                </CardTitle>
                <CardDescription>Your team's tournament registrations</CardDescription>
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
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-3">No tournament registrations yet</p>
                    <Button asChild size="sm">
                      <Link href="/tournaments">
                        <Trophy className="w-4 h-4 mr-2" />
                        Browse Tournaments
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold text-foreground">{memberToRemove?.name}</span> from the team? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (memberToRemove) {
                  handleRemoveMember(memberToRemove.id)
                  setMemberToRemove(null)
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Captain Transfer Dialog */}
      <Dialog open={showCaptainTransfer} onOpenChange={setShowCaptainTransfer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Team Captain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a team member to transfer captaincy to. Once transferred, you will no longer be the team captain.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {teamMembers
                .filter(member => member.id !== team?.captain_id)
                .map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedNewCaptain(member.id)}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${selectedNewCaptain === member.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {member.summoner_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.summoner_name}</p>
                        <p className="text-xs text-muted-foreground">{member.main_role}</p>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCaptainTransfer(false)
                setSelectedNewCaptain(null)
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferCaptain}
              disabled={!selectedNewCaptain || transferringCaptain}
              className="flex-1"
            >
              {transferringCaptain ? 'Transferring...' : 'Transfer Captain'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </main>
  )
}
