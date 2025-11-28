'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, Save, Trophy, Calendar, Users, Settings, 
  BarChart3, Copy, Trash2, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

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
  status?: 'Registration' | 'Registration_Closed' | 'Seeding' | 'In_Progress' | 'Completed' | 'Cancelled'
  format?: 'Single_Elimination' | 'Double_Elimination' | 'Round_Robin' | 'Swiss'
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
}

export default function TournamentManagePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const tournamentId = params.id as string
  
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    async function fetchTournament() {
      try {
        const supabase = createClient()
        const isNumber = /^\d+$/.test(tournamentId)
        
        let query = supabase.from('tournaments').select('*')
        
        if (isNumber) {
          query = query.eq('tournament_number', parseInt(tournamentId))
        } else {
          query = query.eq('id', tournamentId)
        }
        
        const { data, error } = await query.single()
        
        if (error) {
          console.error('Failed to fetch tournament:', error)
        } else {
          // Fetch registration count
          const { count: registrationCount } = await supabase
            .from('tournament_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', data.id)
          
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
            registration_count: registrationCount || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch tournament:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTournament()
  }, [tournamentId])

  const handleInputChange = (field: keyof Tournament, value: any) => {
    if (!tournament) return
    setTournament({ ...tournament, [field]: value })
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!tournament) return
    setSaving(true)
    try {
      // Only send fields that can be updated
      const updateData = {
        name: tournament.name,
        description: tournament.description,
        start_date: tournament.start_date,
        end_date: tournament.end_date,
        prize_pool: tournament.prize_pool,
        max_teams: tournament.max_teams,
        format: tournament.format,
        registration_deadline: tournament.registration_deadline || null,
        current_round: tournament.current_round,
        total_rounds: tournament.total_rounds,
        is_active: tournament.is_active,
        swiss_rounds: tournament.swiss_rounds,
        enable_top_cut: tournament.enable_top_cut,
        top_cut_size: tournament.top_cut_size,
        opening_best_of: tournament.opening_best_of,
        progression_best_of: tournament.progression_best_of,
        elimination_best_of: tournament.elimination_best_of,
      }
      
      const response = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      if (response.ok) {
        setHasUnsavedChanges(false)
        toast({ title: "Success", description: "Tournament settings saved." })
      } else {
        const error = await response.json()
        console.error('Save error:', error)
        toast({ title: "Error", description: error.error || "Failed to save.", variant: "destructive" })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
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
          toast({ title: "Deleted", description: "Tournament has been deleted." })
          router.push('/admin?tab=tournaments')
        } else {
          toast({ title: "Error", description: "Failed to delete.", variant: "destructive" })
        }
      } catch (error) {
        toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
      }
    }
  }

  const handleDuplicate = async () => {
    if (!tournament) return
    const newName = prompt(`Enter name for duplicated tournament:`, `${tournament.name} (Copy)`)
    if (!newName) return
    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: tournament.description,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          prize_pool: tournament.prize_pool,
          max_teams: tournament.max_teams,
          format: tournament.format
        }),
      })
      if (response.ok) {
        toast({ title: "Duplicated", description: "A new tournament has been created." })
        router.push('/admin?tab=tournaments')
      } else {
        toast({ title: "Error", description: "Failed to duplicate.", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <main className="pt-20">
        <section className="bg-gradient-to-b from-background to-card px-4 py-6 min-h-screen">
          <div className="max-w-6xl mx-auto w-full flex justify-center items-center h-[50vh]">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
        <section className="bg-gradient-to-b from-background to-card px-4 py-6 min-h-screen">
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
        <div className="max-w-6xl mx-auto w-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin?tab=tournaments">
                <Button variant="outline" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{tournament.name}</h1>
                  {tournament.tournament_number && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      #{tournament.tournament_number}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">{tournament.status?.replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</Button>
              <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
              <Button onClick={handleSave} disabled={!hasUnsavedChanges || saving}>
                <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Unsaved Warning */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <p className="text-sm font-medium">You have unsaved changes.</p>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-3 lg:w-[600px]">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="format">Format & Rules</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>General Information</CardTitle>
                      <CardDescription>Basic details about the tournament.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                        <Textarea id="description" value={tournament.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={5} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prize_pool">Prize Pool</Label>
                        <Input id="prize_pool" value={tournament.prize_pool} onChange={(e) => handleInputChange('prize_pool', e.target.value)} placeholder="e.g., $1,000" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Schedule</CardTitle>
                      <CardDescription>Important dates for the tournament.</CardDescription>
                    </CardHeader>
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
                </TabsContent>
                
                {/* Format Tab */}
                <TabsContent value="format" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tournament Structure</CardTitle>
                      <CardDescription>Define how matches are organized.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="format">Format Type</Label>
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
                              <Label htmlFor="swiss_rounds">Number of Rounds</Label>
                              <Input id="swiss_rounds" type="number" value={tournament.swiss_rounds} onChange={(e) => handleInputChange('swiss_rounds', parseInt(e.target.value))} min={3} max={9} />
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                              <Switch id="enable_top_cut" checked={tournament.enable_top_cut} onCheckedChange={(checked) => handleInputChange('enable_top_cut', checked)} />
                              <Label htmlFor="enable_top_cut">Enable Top Cut</Label>
                            </div>
                          </div>
                          {tournament.enable_top_cut && (
                            <div className="space-y-2">
                              <Label htmlFor="top_cut_size">Top Cut Size</Label>
                              <Input id="top_cut_size" type="number" value={tournament.top_cut_size} onChange={(e) => handleInputChange('top_cut_size', parseInt(e.target.value))} min={2} max={16} />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Match Format</CardTitle>
                      <CardDescription>Configure the match format based on match type.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="opening_best_of">Opening Matches</Label>
                          <Select value={String(tournament.opening_best_of || 1)} onValueChange={(value) => handleInputChange('opening_best_of', parseInt(value))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Best of 1</SelectItem>
                              <SelectItem value="3">Best of 3</SelectItem>
                              <SelectItem value="5">Best of 5</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Standard round matches</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="progression_best_of">Progression Matches</Label>
                          <Select value={String(tournament.progression_best_of || 3)} onValueChange={(value) => handleInputChange('progression_best_of', parseInt(value))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Best of 1</SelectItem>
                              <SelectItem value="3">Best of 3</SelectItem>
                              <SelectItem value="5">Best of 5</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Win to advance (e.g. 2-0 → 3-0)</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="elimination_best_of">Elimination Matches</Label>
                          <Select value={String(tournament.elimination_best_of || 3)} onValueChange={(value) => handleInputChange('elimination_best_of', parseInt(value))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Best of 1</SelectItem>
                              <SelectItem value="3">Best of 3</SelectItem>
                              <SelectItem value="5">Best of 5</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Lose to be eliminated (e.g. 0-2 → 0-3)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Advanced Tab */}
                <TabsContent value="advanced" className="mt-0 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>State Management</CardTitle>
                      <CardDescription>Override tournament state and progress.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label className="text-base">Active Status</Label>
                          <p className="text-sm text-muted-foreground">Controls public visibility.</p>
                        </div>
                        <Switch checked={tournament.is_active} onCheckedChange={(checked) => handleInputChange('is_active', checked)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="current_round">Current Round</Label>
                          <Input id="current_round" type="number" value={tournament.current_round} onChange={(e) => handleInputChange('current_round', parseInt(e.target.value))} min={0} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="total_rounds">Total Rounds</Label>
                          <Input id="total_rounds" type="number" value={tournament.total_rounds} onChange={(e) => handleInputChange('total_rounds', parseInt(e.target.value))} min={0} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Status</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Teams</span>
                      <span className="font-medium">{tournament.registration_count || 0} / {tournament.max_teams}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <span className="px-2 py-1 rounded-full bg-secondary text-xs font-medium">{tournament.status?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm">{new Date(tournament.created_at).toLocaleDateString()}</span>
                    </div>
                    <Separator />
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/tournaments/${tournament.tournament_number || tournament.id}`} target="_blank">View Public Page</Link>
                    </Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="secondary" className="w-full justify-start"><Users className="mr-2 h-4 w-4" />Manage Teams</Button>
                    <Button variant="secondary" className="w-full justify-start"><Settings className="mr-2 h-4 w-4" />Generate Brackets</Button>
                    <Button variant="secondary" className="w-full justify-start"><Trophy className="mr-2 h-4 w-4" />Update Standings</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </Tabs>
        </div>
      </section>
    </main>
  )
}
