'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Trophy, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function CreateTournamentCard() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_teams: 8,
    start_date: '',
    end_date: '',
    prize_pool: '',
    rules: ''
  })
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.start_date || !formData.end_date) {
        throw new Error('Name, start date, and end date are required')
      }

      // Validate dates
      const startDate = new Date(formData.start_date)
      const endDate = new Date(formData.end_date)
      
      if (startDate >= endDate) {
        throw new Error('End date must be after start date')
      }

      const tournamentData = {
        name: formData.name,
        description: formData.description || null,
        max_teams: formData.max_teams,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        prize_pool: formData.prize_pool || null,
        rules: formData.rules || null
      }

      const { error } = await supabase.from('tournaments').insert(tournamentData)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        max_teams: 8,
        start_date: '',
        end_date: '',
        prize_pool: '',
        rules: ''
      })
    } catch (error) {
      console.error('Error creating tournament:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="text-4xl mb-4">🏆</div>
      <CardHeader className="p-0 mb-6">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Create Tournament
        </CardTitle>
        <CardDescription>
          Create a new tournament for your community
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Tournament Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Summer Championship"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Tournament details and rules..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_teams">Max Teams</Label>
            <Input
              id="max_teams"
              type="number"
              min="2"
              max="64"
              value={formData.max_teams}
              onChange={(e) => setFormData({ ...formData, max_teams: parseInt(e.target.value) })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="prize_pool">Prize Pool</Label>
            <Input
              id="prize_pool"
              value={formData.prize_pool}
              onChange={(e) => setFormData({ ...formData, prize_pool: e.target.value })}
              placeholder="$10,000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="rules">Rules</Label>
          <Textarea
            id="rules"
            value={formData.rules}
            onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
            placeholder="Tournament rules and format..."
            rows={4}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating...' : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </>
          )}
        </Button>
      </form>
    </Card>
  )
}
