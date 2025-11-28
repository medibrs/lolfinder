'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Trophy, Users, Calendar, Settings, Shield, Activity, 
  Play, Pause, CheckCircle, XCircle, AlertTriangle, 
  ChevronRight, Search, Filter, MoreHorizontal, RefreshCw,
  Swords, Medal, History, FileText, Gavel
} from 'lucide-react'
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface TournamentManagerProps {
  tournamentId: string
  onClose: () => void
}

export default function TournamentManager({ tournamentId, onClose }: TournamentManagerProps) {
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const supabase = createClient()
  const { toast } = useToast()

  // Data states
  const [participants, setParticipants] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [linkedTournaments, setLinkedTournaments] = useState<any[]>([])

  // Add Participant State
  const [addParticipantOpen, setAddParticipantOpen] = useState(false)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [selectedTeamToAdd, setSelectedTeamToAdd] = useState<string>('')
  
  // Promote Stage State
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState('')
  const [promoteCount, setPromoteCount] = useState(4)

  useEffect(() => {
    fetchTournamentData()
  }, [tournamentId])

  useEffect(() => {
    if (addParticipantOpen) {
      fetchAllTeams()
    }
  }, [addParticipantOpen])

  const fetchAllTeams = async () => {
    const { data } = await supabase.from('teams').select('id, name, captain_id')
    if (data) setAllTeams(data)
  }

  const handleCreateNextStage = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: `${tournament.name} - Stage ${linkedTournaments.length + 2}`,
          description: `Next stage for ${tournament.name}`,
          parent_tournament_id: tournament.parent_tournament_id || tournament.id,
          stage_order: (tournament.stage_order || 0) + 1,
          start_date: new Date(Date.now() + 86400000).toISOString(), // +1 day
          end_date: new Date(Date.now() + 172800000).toISOString(), // +2 days
          max_teams: Math.max(2, Math.floor(tournament.max_teams / 2)),
          format: 'Single_Elimination',
          status: 'Registration'
        })
        .select()
        .single()

      if (error) throw error

      toast({ title: "Next stage created successfully" })
      fetchTournamentData()
    } catch (error) {
      toast({ title: "Failed to create stage", variant: "destructive" })
    }
  }

  const handlePromoteTeams = async () => {
    if (!promoteTarget) return

    try {
      // In a real app, we would call the promote_teams RPC function
      // For now, we'll do a client-side promotion simulation since we can't easily add RPCs
      
      // 1. Get top N teams
      const topTeams = [...participants]
        .sort((a, b) => (b.swiss_score || 0) - (a.swiss_score || 0))
        .slice(0, promoteCount)

      // 2. Add to target tournament
      const promotions = topTeams.map((p, index) => ({
        tournament_id: promoteTarget,
        team_id: p.team_id,
        seed_number: index + 1,
        is_active: true
      }))

      const { error } = await supabase
        .from('tournament_participants')
        .insert(promotions)

      if (error) throw error

      toast({ title: `Promoted ${promotions.length} teams successfully` })
      setPromoteDialogOpen(false)
    } catch (error) {
      toast({ title: "Promotion failed", description: error.message, variant: "destructive" })
    }
  }

  const handleAddParticipant = async () => {
    if (!selectedTeamToAdd) return

    try {
      const { error } = await supabase.from('tournament_participants').insert({
        tournament_id: tournamentId,
        team_id: selectedTeamToAdd,
        seed_number: participants.length + 1,
        is_active: true
      })

      if (error) throw error

      // Also add to registrations table for compatibility if needed, or just rely on participants
      // The system seems to use tournament_registrations for the sign-up process
      // and tournament_participants for the actual event. I should probably add to both to be safe.
      
      await supabase.from('tournament_registrations').insert({
        tournament_id: tournamentId,
        team_id: selectedTeamToAdd,
        status: 'approved'
      })

      toast({ title: "Participant added successfully" })
      setAddParticipantOpen(false)
      setSelectedTeamToAdd('')
      fetchTournamentData()
    } catch (error) {
      toast({ 
        title: "Failed to add participant", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  }

  const fetchTournamentData = async () => {
    setLoading(true)
    try {
      // Fetch basic tournament info
      const { data: tData, error: tError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single()

      if (tError) throw tError
      setTournament(tData)

      // Fetch participants with team details
      const { data: pData, error: pError } = await supabase
        .from('tournament_participants')
        .select('*, team:teams(*)')
        .eq('tournament_id', tournamentId)
        .order('seed_number', { ascending: true })

      if (pError) throw pError
      setParticipants(pData || [])

      // Fetch matches
      const { data: mData, error: mError } = await supabase
        .from('tournament_matches')
        .select('*, team1:teams!team1_id(name), team2:teams!team2_id(name)')
        .eq('tournament_id', tournamentId)
        .order('match_number', { ascending: true })

      if (mError) throw mError
      setMatches(mData || [])

      // Fetch logs
      const { data: lData, error: lError } = await supabase
        .from('tournament_logs')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (lError) throw lError
      setLogs(lData || [])

      // Fetch admins
      const { data: aData, error: aError } = await supabase
        .from('tournament_admins')
        .select('*, user:user_id(email)')
        .eq('tournament_id', tournamentId)

      if (aError) throw aError
      setAdmins(aData || [])

      // Fetch Linked Tournaments (Stages)
      // Get children
      const { data: childrenData } = await supabase
        .from('tournaments')
        .select('id, name, stage_order, status, format')
        .eq('parent_tournament_id', tournamentId)
        .order('stage_order', { ascending: true })

      // Get parent if exists
      let parentData = null
      if (tData.parent_tournament_id) {
        const { data: pData } = await supabase
          .from('tournaments')
          .select('id, name, stage_order, status, format')
          .eq('id', tData.parent_tournament_id)
          .single()
        parentData = pData
      }
      
      // Combine into a flat list for the UI, marking relationships
      const linked = []
      if (parentData) linked.push({ ...parentData, relation: 'Parent' })
      if (childrenData) childrenData.forEach((c: any) => linked.push({ ...c, relation: 'Child' }))
      setLinkedTournaments(linked)

      // Calculate/Fetch standings if available
      // This would typically come from a view or a calculation function
      // For now we'll assume a basic fetch or local calc
      
    } catch (error) {
      console.error('Error fetching tournament data:', error)
      toast({
        title: "Error loading tournament",
        description: "Could not load tournament details. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateMatch = async (matchId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('tournament_matches')
        .update(updates)
        .eq('id', matchId)

      if (error) throw error

      toast({ title: "Match updated successfully" })
      fetchTournamentData()
    } catch (error) {
      toast({ 
        title: "Update failed", 
        description: error.message, 
        variant: "destructive" 
      })
    }
  }

  const handleGeneratePairings = async () => {
    // This would call a server-side function or API endpoint
    // For now we'll mock the API call
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/swiss/pairings`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to generate pairings')
      
      toast({ title: "Pairings generated for next round" })
      fetchTournamentData()
    } catch (error) {
      toast({ 
        title: "Pairing generation failed", 
        description: "Could not generate pairings. Ensure previous round is complete.", 
        variant: "destructive" 
      })
    }
  }

  const handleSeedUpdate = async (participantId: string, newSeed: number) => {
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .update({ seed_number: newSeed })
        .eq('id', participantId)

      if (error) throw error
      fetchTournamentData()
    } catch (error) {
      console.error('Error updating seed:', error)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  }

  if (!tournament) return <div>Tournament not found</div>

  return (
    <div className="flex flex-col h-[85vh]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{tournament.name}</h2>
            <div className="flex flex-wrap gap-2">
              <Badge variant={tournament.is_active ? "default" : "secondary"}>
                {tournament.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="uppercase">
                {tournament.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="uppercase border-primary text-primary">
                {tournament.format.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(tournament.start_date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {participants.length} Teams
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              {tournament.prize_pool}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          {tournament.status === 'Registration' && (
            <Button onClick={() => {/* Start tournament logic */}} className="w-full sm:w-auto">
              <Play className="h-4 w-4 mr-2" /> Start Tournament
            </Button>
          )}
          {tournament.status === 'In_Progress' && (
            <Button variant="destructive" onClick={() => {/* End tournament logic */}} className="w-full sm:w-auto">
              <CheckCircle className="h-4 w-4 mr-2" /> Complete Tournament
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 mt-6 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="overflow-x-auto">
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 mb-4 min-w-max">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="stages" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Stages & Promotion</TabsTrigger>
              <TabsTrigger value="participants" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Participants & Seeding</TabsTrigger>
              <TabsTrigger value="matches" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Matches & Bracket</TabsTrigger>
              <TabsTrigger value="admins" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Admins</TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Audit Logs</TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none whitespace-nowrap">Settings</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="space-y-6 m-0 pb-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quick Stats */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      Round {tournament.current_round} <span className="text-muted-foreground text-lg font-normal">/ {tournament.total_rounds}</span>
                    </div>
                    <div className="h-2 w-full bg-secondary mt-2 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${(tournament.current_round / tournament.total_rounds) * 100}%` }} 
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Matches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {matches.filter(m => m.status === 'Completed').length} <span className="text-muted-foreground text-lg font-normal">/ {matches.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {matches.filter(m => m.status === 'In_Progress').length} currently live
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {participants.filter(p => p.is_active).length} <span className="text-muted-foreground text-lg font-normal">/ {tournament.max_teams}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {participants.filter(p => !p.is_active).length} dropped/disqualified
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {logs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">No recent activity</div>
                    ) : (
                      logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                          <div className={`
                            mt-1 h-2 w-2 rounded-full 
                            ${log.impact_level === 'critical' ? 'bg-red-500' : 
                              log.impact_level === 'high' ? 'bg-orange-500' : 
                              log.impact_level === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}
                          `} />
                          <div>
                            <p className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{log.details}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stages" className="space-y-6 m-0 pb-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Tournament Hierarchy</h3>
                  <p className="text-sm text-muted-foreground">Manage linked stages (Qualifiers → Groups → Playoffs).</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                   <Button onClick={handleCreateNextStage} className="w-full sm:w-auto">
                    <Play className="h-4 w-4 mr-2" /> Create Next Stage
                  </Button>
                  <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto"><Trophy className="h-4 w-4 mr-2" /> Promote Teams</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Promote Teams to Next Stage</DialogTitle>
                        <DialogDescription>Move top performing teams to a connected tournament.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Target Tournament</Label>
                          <Select value={promoteTarget} onValueChange={setPromoteTarget}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select target stage..." />
                            </SelectTrigger>
                            <SelectContent>
                              {linkedTournaments
                                .filter(t => t.relation === 'Child')
                                .map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Teams to Promote (Top N)</Label>
                          <Input 
                            type="number" 
                            value={promoteCount} 
                            onChange={e => setPromoteCount(parseInt(e.target.value))} 
                          />
                          <p className="text-xs text-muted-foreground">
                            Will select top {promoteCount} teams based on current standings.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handlePromoteTeams} disabled={!promoteTarget}>Promote Teams</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-6">
                {/* Tree Visualization */}
                <div className="relative pl-8 border-l-2 border-muted space-y-8">
                   {/* Current Node Context */}
                   <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary" />
                   
                   {linkedTournaments.filter(t => t.relation === 'Parent').map(parent => (
                      <div key={parent.id} className="relative">
                        <div className="absolute -left-[41px] top-1/2 w-8 h-0.5 bg-muted" />
                        <Card className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              {parent.name} <Badge variant="secondary">Parent</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <p className="text-sm text-muted-foreground">Format: {parent.format}</p>
                          </CardContent>
                        </Card>
                      </div>
                   ))}

                   <div className="relative">
                      <div className="absolute -left-[41px] top-1/2 w-8 h-0.5 bg-primary" />
                      <Card className="border-primary bg-primary/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            {tournament.name} <Badge>Current</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <p className="text-sm text-muted-foreground">Format: {tournament.format}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {participants.length} Teams</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(tournament.start_date).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                   </div>

                   {linkedTournaments.filter(t => t.relation === 'Child').map(child => (
                      <div key={child.id} className="relative">
                        <div className="absolute -left-[41px] top-1/2 w-8 h-0.5 bg-muted" />
                        <Card className="opacity-80 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => window.location.search = `?tab=tournaments&id=${child.id}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              {child.name} <Badge variant="outline">Stage {child.stage_order}</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <p className="text-sm text-muted-foreground">Format: {child.format}</p>
                            <Badge variant={child.status === 'Registration' ? 'secondary' : 'default'} className="mt-2">
                              {child.status}
                            </Badge>
                          </CardContent>
                        </Card>
                      </div>
                   ))}
                </div>

                {linkedTournaments.length === 0 && (
                   <div className="text-center py-8 text-muted-foreground border rounded-lg">
                     <p>This tournament is standalone. Create a next stage to build a series.</p>
                   </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="participants" className="space-y-4 m-0 pb-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Input placeholder="Search teams..." className="w-full sm:w-[300px]" />
                  <Button variant="outline" className="w-full sm:w-auto"><Filter className="h-4 w-4 mr-2" /> Filter</Button>
                </div>
                <Dialog open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
                  <DialogTrigger asChild>
                    <Button><Users className="h-4 w-4 mr-2" /> Add Participant</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Participant</DialogTitle>
                      <DialogDescription>Select a team to add to the tournament.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Select value={selectedTeamToAdd} onValueChange={setSelectedTeamToAdd}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allTeams
                            .filter(t => !participants.some(p => p.team_id === t.id))
                            .map(team => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddParticipant} disabled={!selectedTeamToAdd}>Add Team</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Seed</TableHead>
                        <TableHead className="min-w-[150px]">Team</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Stats (W-L)</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {participants.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Input 
                            type="number" 
                            value={p.seed_number} 
                            className="w-16 h-8"
                            onChange={(e) => handleSeedUpdate(p.id, parseInt(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.team?.name}</div>
                          {tournament.format === 'Swiss' && (
                            <div className="text-xs text-muted-foreground">
                              Swiss Score: {p.swiss_score} | TB: {p.tiebreaker_points}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.is_active ? "default" : "destructive"}>
                            {p.is_active ? "Active" : "Dropped"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {/* This would be populated from performance stats */}
                          <span className="text-sm">0 - 0</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4 m-0 pb-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold">Match Management</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  {tournament.format === 'Swiss' && (
                    <Button onClick={handleGeneratePairings} className="w-full sm:w-auto">
                      <RefreshCw className="h-4 w-4 mr-2" /> Generate Next Round
                    </Button>
                  )}
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Settings className="h-4 w-4 mr-2" /> Bracket Settings
                  </Button>
                </div>
              </div>

              {/* Matches List - Grouped by Round */}
              {Array.from(new Set(matches.map(m => m.round_number))).sort().map(round => (
                <Card key={round} className="mb-6">
                  <CardHeader className="py-3 bg-muted/30">
                    <CardTitle className="text-sm font-medium">Round {round}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableBody>
                        {matches.filter(m => m.round_number === round).map(match => (
                          <TableRow key={match.id}>
                            <TableCell className="w-[50px] text-muted-foreground">
                              #{match.match_number}
                            </TableCell>
                            <TableCell className="w-[40%]">
                              <div className="flex items-center justify-between">
                                <span className={match.winner_id === match.team1_id ? "font-bold text-green-600" : ""}>
                                  {match.team1?.name || "TBD"}
                                </span>
                                <span className="font-mono bg-muted px-2 py-1 rounded">
                                  {match.team1_score}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="w-[20px] text-center text-muted-foreground">vs</TableCell>
                            <TableCell className="w-[40%]">
                              <div className="flex items-center justify-between">
                                <span className="font-mono bg-muted px-2 py-1 rounded">
                                  {match.team2_score}
                                </span>
                                <span className={match.winner_id === match.team2_id ? "font-bold text-green-600" : ""}>
                                  {match.team2?.name || "TBD"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="w-[150px]">
                              <Badge variant={
                                match.status === 'Completed' ? 'secondary' :
                                match.status === 'In_Progress' ? 'default' : 'outline'
                              }>
                                {match.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <MatchEditDialog match={match} onUpdate={fetchTournamentData} />
                            </TableCell>
                          </TableRow>
                        ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {matches.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                  <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No matches scheduled yet.</p>
                  <Button className="mt-4" variant="outline">Initialize Bracket</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="admins" className="space-y-4 m-0 pb-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Tournament Administrators</h3>
                  <p className="text-sm text-muted-foreground">Manage access and permissions for this tournament.</p>
                </div>
                <Button variant="outline"><Shield className="h-4 w-4 mr-2" /> Add Admin</Button>
              </div>

              <Card>
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">User</TableHead>
                        <TableHead className="min-w-[100px]">Role</TableHead>
                        <TableHead className="min-w-[200px]">Permissions</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span>{admin.user?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {admin.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {admin.permissions ? JSON.stringify(JSON.parse(admin.permissions), null, 0).slice(0, 30) + '...' : 'Default'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {admins.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No admins assigned specifically to this tournament. Global admins have access.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 m-0 pb-10">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Log</CardTitle>
                  <CardDescription>Complete history of all tournament events and admin actions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Time</TableHead>
                          <TableHead className="min-w-[120px]">Action</TableHead>
                          <TableHead className="min-w-[120px]">Category</TableHead>
                          <TableHead className="min-w-[300px]">Details</TableHead>
                          <TableHead className="min-w-[100px]">Admin</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{log.event_category}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[400px] truncate" title={log.details}>
                            {log.details}
                          </TableCell>
                          <TableCell className="text-xs">
                            {log.user_id ? 'Admin' : 'System'}
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          <TabsContent value="settings" className="space-y-4 m-0 pb-10">
              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                  <CardDescription>Destructive actions for tournament management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/10">
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-200">Reset Tournament</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">Clear all matches, scores, and progress. Keep participants.</p>
                    </div>
                    <Button variant="destructive">Reset</Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/10">
                    <div>
                      <h4 className="font-medium text-red-900 dark:text-red-200">Delete Tournament</h4>
                      <p className="text-sm text-red-700 dark:text-red-300">Permanently remove tournament and all associated data.</p>
                    </div>
                    <Button variant="destructive">Delete</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}

function MatchEditDialog({ match, onUpdate }: { match: any, onUpdate: () => void }) {
  const [open, setOpen] = useState(false)
  const [scores, setScores] = useState({ t1: match.team1_score || 0, t2: match.team2_score || 0 })
  const [status, setStatus] = useState(match.status)
  const [winner, setWinner] = useState(match.winner_id || '')
  const supabase = createClient()
  const { toast } = useToast()

  const handleSave = async () => {
    try {
      const updates: any = {
        team1_score: scores.t1,
        team2_score: scores.t2,
        status: status,
        winner_id: winner || null
      }

      if (status === 'Completed' && !winner) {
        // Auto determine winner if scores provided
        if (scores.t1 > scores.t2) updates.winner_id = match.team1_id
        if (scores.t2 > scores.t1) updates.winner_id = match.team2_id
      }

      const { error } = await supabase
        .from('tournament_matches')
        .update(updates)
        .eq('id', match.id)

      if (error) throw error

      // Log the action
      await supabase.from('tournament_logs').insert({
        tournament_id: match.tournament_id,
        action: 'MATCH_RESULT_OVERRIDDEN',
        details: `Match ${match.match_number} updated. Score: ${scores.t1}-${scores.t2}, Status: ${status}`,
        match_id: match.id,
        event_category: 'admin',
        impact_level: 'medium'
      })

      toast({ title: "Match updated" })
      setOpen(false)
      onUpdate()
    } catch (error) {
      toast({ title: "Error updating match", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Match Result</DialogTitle>
          <DialogDescription>
            Update scores and status for Match #{match.match_number}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 items-center gap-4 text-center">
            <div className="font-medium">{match.team1?.name || 'TBD'}</div>
            <div className="text-xs text-muted-foreground">vs</div>
            <div className="font-medium">{match.team2?.name || 'TBD'}</div>
          </div>
          
          <div className="grid grid-cols-3 items-center gap-4">
            <Input 
              type="number" 
              value={scores.t1} 
              onChange={e => setScores({ ...scores, t1: parseInt(e.target.value) })}
              className="text-center"
            />
            <div className="text-center text-sm font-medium">Score</div>
            <Input 
              type="number" 
              value={scores.t2} 
              onChange={e => setScores({ ...scores, t2: parseInt(e.target.value) })}
              className="text-center"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="In_Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Winner</Label>
            <Select value={winner} onValueChange={setWinner}>
              <SelectTrigger>
                <SelectValue placeholder="Select Winner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={match.team1_id}>{match.team1?.name || 'Team 1'}</SelectItem>
                <SelectItem value={match.team2_id}>{match.team2?.name || 'Team 2'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
