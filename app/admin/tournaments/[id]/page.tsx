'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Save, Trophy, Calendar, Users, Settings,
  BarChart3, Copy, Trash2, AlertTriangle, GitBranch,
  ImagePlus, X, ExternalLink, Loader2, Shuffle
} from 'lucide-react'
import LifecycleBar from '@/components/admin/tournament/LifecycleBar'
import BracketManager from '@/components/admin/tournament/BracketManager'
import MatchDirector from '@/components/admin/tournament/MatchDirector'
import SeedingManager from '@/components/admin/tournament/SeedingManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────────────

interface Tournament {
  id: string
  name: string
  description: string
  start_date: string
  end_date: string
  prize_pool: string
  max_teams: number
  created_at: string
  registration_count?: number
  status?: string
  format?: string
  registration_deadline?: string
  current_round?: number
  total_rounds?: number
  is_active?: boolean
  swiss_rounds?: number
  enable_top_cut?: boolean
  top_cut_size?: number
  tournament_number?: number
  opening_best_of?: number
  progression_best_of?: number
  elimination_best_of?: number
  finals_best_of?: number
  banner_image?: string
}

interface StateCapabilities {
  can_register: boolean
  can_edit_seeding: boolean
  can_generate_bracket: boolean
  can_play_matches: boolean
  can_advance_round: boolean
  can_modify_pairings: boolean
  is_mutable: boolean
  is_terminal: boolean
}

// ─── Page ───────────────────────────────────────────────────────────

export default function TournamentManagePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const tournamentId = params.id as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Lifecycle state
  const [capabilities, setCapabilities] = useState<StateCapabilities | null>(null)
  const [lifecycleState, setLifecycleState] = useState<string>('')

  // Shared match data — fetched once, passed to all components
  const [matchData, setMatchData] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [bracketGenerated, setBracketGenerated] = useState(false)

  // ─── Data Loading ─────────────────────────────────────────────

  const fetchTournament = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}`)
      const data = await response.json()
      if (!response.ok) return

      setTournament({
        ...data,
        description: data.description || '',
        prize_pool: data.prize_pool || '',
        format: data.format || 'Single_Elimination',
        registration_deadline: data.registration_deadline || '',
        current_round: data.current_round || 0,
        total_rounds: data.total_rounds || 0,
        is_active: data.is_active !== false,
        swiss_rounds: data.swiss_rounds || 5,
        enable_top_cut: data.enable_top_cut || false,
        top_cut_size: data.top_cut_size || 8,
        registration_count: data.registered_teams_count || 0,
      })
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

  const fetchSeeding = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/seeding`)
      if (res.ok) {
        const data = await res.json()
        setParticipants(data.participants || [])
        setBracketGenerated(data.bracket_generated || false)
      }
    } catch (_) { }
  }, [tournamentId])

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/matches`)
      if (res.ok) {
        const data = await res.json()
        setMatchData(data.matches || [])
      }
    } catch (_) { }
  }, [tournamentId])

  useEffect(() => {
    fetchTournament()
    fetchSeeding()
    fetchMatches()
  }, [fetchTournament, fetchSeeding, fetchMatches])

  // ─── Lifecycle Callbacks ──────────────────────────────────────

  const handleLifecycleChanged = useCallback((state: string, caps: StateCapabilities) => {
    setLifecycleState(state)
    setCapabilities(caps)
    fetchTournament()
  }, [fetchTournament])

  const handleBracketChanged = useCallback(() => {
    fetchSeeding()
    fetchMatches()
    fetchTournament()
  }, [fetchSeeding, fetchMatches, fetchTournament])

  const handleMatchStateChanged = useCallback(() => {
    fetchMatches()
    fetchSeeding()
  }, [fetchMatches, fetchSeeding])

  // ─── Form Handlers ────────────────────────────────────────────

  const handleInputChange = (field: keyof Tournament, value: any) => {
    if (!tournament) return
    setTournament({ ...tournament, [field]: value })
    setHasUnsavedChanges(true)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tournament) return
    setUploadingBanner(true)
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    uploadFormData.append('tournamentId', tournament.id)
    try {
      const response = await fetch('/api/tournaments/upload-banner', { method: 'POST', body: uploadFormData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to upload banner')
      setTournament({ ...tournament, banner_image: data.url })
      setHasUnsavedChanges(true)
      toast({ title: 'Success', description: "Banner uploaded. Don't forget to save!" })
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' })
    } finally {
      setUploadingBanner(false)
    }
  }

  const removeBanner = () => {
    if (!tournament) return
    setTournament({ ...tournament, banner_image: undefined })
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!tournament) return
    setSaving(true)
    try {
      const updateData = {
        name: tournament.name, description: tournament.description,
        start_date: tournament.start_date, end_date: tournament.end_date,
        prize_pool: tournament.prize_pool, max_teams: tournament.max_teams,
        format: tournament.format, registration_deadline: tournament.registration_deadline || null,
        current_round: tournament.current_round, is_active: tournament.is_active,
        swiss_rounds: tournament.swiss_rounds, enable_top_cut: tournament.enable_top_cut,
        top_cut_size: tournament.top_cut_size,
        opening_best_of: tournament.opening_best_of,
        progression_best_of: tournament.progression_best_of,
        elimination_best_of: tournament.elimination_best_of,
        finals_best_of: tournament.finals_best_of,
        banner_image: tournament.banner_image || null,
      }
      const response = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      if (response.ok) {
        setHasUnsavedChanges(false)
        toast({ title: 'Saved', description: 'Tournament settings saved.' })
      } else {
        const error = await response.json()
        toast({ title: 'Error', description: error.error || 'Failed to save.', variant: 'destructive' })
      }
    } catch (_) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!tournament) return
    if (confirm('Delete this tournament? This will also delete all registrations, matches, and related data.')) {
      try {
        const response = await fetch(`/api/tournaments/${tournament.id}`, { method: 'DELETE' })
        if (response.ok) {
          toast({ title: 'Deleted', description: 'Tournament has been deleted.' })
          router.push('/admin?tab=tournaments')
        } else {
          toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' })
        }
      } catch (_) {
        toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' })
      }
    }
  }

  const handleDuplicate = async () => {
    if (!tournament) return
    const newName = prompt('Enter name for duplicated tournament:', `${tournament.name} (Copy)`)
    if (!newName) return
    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName, description: tournament.description,
          start_date: tournament.start_date, end_date: tournament.end_date,
          prize_pool: tournament.prize_pool, max_teams: tournament.max_teams,
          format: tournament.format,
        }),
      })
      if (response.ok) {
        toast({ title: 'Duplicated', description: 'A new tournament has been created.' })
        router.push('/admin?tab=tournaments')
      }
    } catch (_) {
      toast({ title: 'Error', description: 'Failed to duplicate.', variant: 'destructive' })
    }
  }

  // ─── Seeding Generation ───────────────────────────────────────

  const handleGenerateSeeding = async (method: 'random' | 'rank') => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_seeding', seeding_method: method }),
      })
      if (response.ok) {
        toast({ title: 'Success', description: `Seeding generated (${method})` })
        fetchSeeding()
      } else {
        const data = await response.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  // ─── Loading / Error States ───────────────────────────────────

  if (loading) {
    return (
      <main className="pt-20">
        <section className="px-4 py-6 min-h-screen">
          <div className="max-w-6xl mx-auto w-full flex justify-center items-center h-[50vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading tournament...</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (!tournament) {
    return (
      <main className="pt-20">
        <section className="px-4 py-6 min-h-screen">
          <div className="max-w-6xl mx-auto w-full">
            <Card className="text-center py-12">
              <CardContent>
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
                <p className="text-muted-foreground mb-6">The tournament does not exist or has been deleted.</p>
                <Link href="/admin?tab=tournaments">
                  <Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Tournaments</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="pt-20 pb-20">
      <section className="px-4 py-6 min-h-screen bg-muted/10">
        <div className="max-w-6xl mx-auto w-full space-y-5">

          {/* ─── Header ──────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin?tab=tournaments">
                <Button variant="outline" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{tournament.name}</h1>
                  {tournament.tournament_number && (
                    <Badge variant="outline" className="text-xs">#{tournament.tournament_number}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {tournament.format?.replace('_', ' ')} · {tournament.registration_count || 0}/{tournament.max_teams} teams
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tournaments/${tournament.tournament_number || tournament.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />View Public
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Duplicate
              </Button>
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saving} size="sm">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Unsaved Warning */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg p-3 flex items-center gap-3 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Unsaved changes — save before switching tabs.</span>
            </div>
          )}

          {/* ─── Lifecycle Bar ───────────────────────────────────── */}
          <LifecycleBar
            tournamentId={tournament.id}
            onStateChanged={handleLifecycleChanged}
          />

          {/* ─── Tabs ────────────────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="overview" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Overview
              </TabsTrigger>
              <TabsTrigger value="seeding" className="text-xs">
                <Users className="h-3.5 w-3.5 mr-1.5" />Seeding
              </TabsTrigger>
              <TabsTrigger value="matches" className="text-xs">
                <Trophy className="h-3.5 w-3.5 mr-1.5" />Matches
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                <Settings className="h-3.5 w-3.5 mr-1.5" />Settings
              </TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ──────────────────────────────────── */}
            <TabsContent value="overview" className="mt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{tournament.registration_count || 0}</p>
                        <p className="text-xs text-muted-foreground">/ {tournament.max_teams} teams</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <GitBranch className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">Round {tournament.current_round || 0}</p>
                        <p className="text-xs text-muted-foreground">/ {tournament.total_rounds || '?'} rounds</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {matchData.filter(m => m.status === 'Completed').length}
                        </p>
                        <p className="text-xs text-muted-foreground">/ {matchData.length} matches done</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bracket Preview */}
              <BracketManager
                tournamentId={tournament.id}
                tournamentFormat={tournament.format}
                maxTeams={tournament.max_teams}
                participants={participants}
                matchData={matchData}
                bracketGenerated={bracketGenerated}
                canGenerate={capabilities?.can_generate_bracket !== false && participants.length >= 2}
                onBracketChanged={handleBracketChanged}
              />
            </TabsContent>

            {/* ─── Seeding Tab ───────────────────────────────────── */}
            <TabsContent value="seeding" className="mt-5 space-y-5">
              {/* Generate Seeding Actions */}
              {participants.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Generate Initial Seeding</CardTitle>
                    <CardDescription>Create seeding from approved team registrations.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleGenerateSeeding('random')}>
                      <Shuffle className="h-3.5 w-3.5 mr-1.5" />Random Seeding
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleGenerateSeeding('rank')}>
                      <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Seed by Rank
                    </Button>
                  </CardContent>
                </Card>
              )}

              <SeedingManager
                tournamentId={tournament.id}
                tournamentFormat={tournament.format}
                isLocked={capabilities?.can_edit_seeding === false}
                matchData={matchData}
                onSeedingUpdate={() => { fetchSeeding(); fetchMatches() }}
              />
            </TabsContent>

            {/* ─── Matches Tab ───────────────────────────────────── */}
            <TabsContent value="matches" className="mt-5 space-y-5">
              <MatchDirector
                tournamentId={tournament.id}
                tournamentFormat={tournament.format}
                matchData={matchData}
                canAdvance={capabilities?.can_advance_round !== false}
                onStateChanged={handleMatchStateChanged}
                onMatchDataUpdate={setMatchData}
              />
            </TabsContent>

            {/* ─── Settings Tab ──────────────────────────────────── */}
            <TabsContent value="settings" className="mt-5 space-y-5">
              {/* General Info */}
              <Card>
                <CardHeader>
                  <CardTitle>General Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Banner */}
                  <div className="space-y-2">
                    <Label>Tournament Banner</Label>
                    <div className="relative group">
                      {tournament.banner_image ? (
                        <div className="relative aspect-[29/9] w-full rounded-lg overflow-hidden border border-border bg-muted">
                          <Image src={tournament.banner_image} alt="Banner" fill className="object-cover" />
                          <button onClick={removeBanner} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors z-10">
                            <X className="h-4 w-4" />
                          </button>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Label htmlFor="banner-upload" className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
                              Change Banner
                            </Label>
                          </div>
                        </div>
                      ) : (
                        <Label htmlFor="banner-upload" className="flex flex-col items-center justify-center aspect-[29/9] w-full rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer">
                          <div className="flex flex-col items-center gap-2">
                            <div className="p-3 rounded-full bg-primary/10 text-primary"><ImagePlus className="h-6 w-6" /></div>
                            <div className="text-center">
                              <p className="text-sm font-medium">Upload Banner</p>
                              <p className="text-xs text-muted-foreground">2320×720 recommended (Max 5MB)</p>
                            </div>
                          </div>
                        </Label>
                      )}
                      <input id="banner-upload" type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                    </div>
                    {uploadingBanner && (
                      <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />Uploading...
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Tournament Name</Label>
                      <Input id="name" value={tournament.name} onChange={(e) => handleInputChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_teams">Max Teams</Label>
                      <Input id="max_teams" type="number" value={tournament.max_teams} onChange={(e) => handleInputChange('max_teams', parseInt(e.target.value))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={tournament.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prize_pool">Prize Pool</Label>
                    <Input id="prize_pool" value={tournament.prize_pool} onChange={(e) => handleInputChange('prize_pool', e.target.value)} placeholder="e.g., $1,000" />
                  </div>
                </CardContent>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input id="start_date" type="datetime-local" value={tournament.start_date?.slice(0, 16)} onChange={(e) => handleInputChange('start_date', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input id="end_date" type="datetime-local" value={tournament.end_date?.slice(0, 16)} onChange={(e) => handleInputChange('end_date', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration_deadline">Registration Deadline</Label>
                    <Input id="registration_deadline" type="datetime-local" value={tournament.registration_deadline?.slice(0, 16)} onChange={(e) => handleInputChange('registration_deadline', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Teams can't join after this date.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Format */}
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Format Type</Label>
                    <Select value={tournament.format} onValueChange={(value: any) => handleInputChange('format', value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single_Elimination">Single Elimination</SelectItem>
                        <SelectItem value="Double_Elimination">Double Elimination</SelectItem>
                        <SelectItem value="Round_Robin">Round Robin</SelectItem>
                        <SelectItem value="Swiss">Swiss System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tournament.format === 'Swiss' && (
                    <div className="bg-muted/50 p-4 rounded-lg border space-y-4">
                      <h3 className="font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4" />Swiss Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Number of Rounds</Label>
                          <Input type="number" value={tournament.swiss_rounds} onChange={(e) => handleInputChange('swiss_rounds', parseInt(e.target.value))} min={3} max={9} />
                        </div>
                        <div className="flex items-center space-x-2 pt-8">
                          <Switch checked={tournament.enable_top_cut} onCheckedChange={(checked) => handleInputChange('enable_top_cut', checked)} />
                          <Label>Enable Top Cut</Label>
                        </div>
                      </div>
                      {tournament.enable_top_cut && (
                        <div className="space-y-2">
                          <Label>Top Cut Size</Label>
                          <Input type="number" value={tournament.top_cut_size} onChange={(e) => handleInputChange('top_cut_size', parseInt(e.target.value))} min={2} max={16} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Best-of settings */}
                  <div className="space-y-3">
                    <h3 className="font-medium text-sm">Match Format</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {([
                        { field: 'opening_best_of', label: 'Opening', default: 1, desc: 'Standard rounds' },
                        { field: 'progression_best_of', label: 'Progression', default: 3, desc: 'Win to advance' },
                        { field: 'elimination_best_of', label: 'Elimination', default: 3, desc: 'Lose to drop' },
                        { field: 'finals_best_of', label: 'Finals', default: 5, desc: 'Championship' },
                      ] as const).map(({ field, label, default: def, desc }) => (
                        <div key={field} className="space-y-1.5">
                          <Label className="text-xs">{label}</Label>
                          <Select value={String(tournament[field] || def)} onValueChange={(v) => handleInputChange(field, parseInt(v))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Bo1</SelectItem>
                              <SelectItem value="3">Bo3</SelectItem>
                              <SelectItem value="5">Bo5</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced / Danger Zone */}
              <Card className="border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm">Active Status</Label>
                      <p className="text-xs text-muted-foreground">Controls public visibility.</p>
                    </div>
                    <Switch checked={tournament.is_active} onCheckedChange={(checked) => handleInputChange('is_active', checked)} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Delete Tournament</p>
                      <p className="text-xs text-muted-foreground">Permanently remove all data.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  )
}
