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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    captain_id: '',
    team_size: '5' as '5' | '6', // 5 players (main) or 6 players (5 + sub)
    open_positions: [] as string[],
    recruiting_status: 'Open' as 'Open' | 'Closed' | 'Full'
  })

  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/user')
        if (response.ok) {
          const { user } = await response.json()
          setUserId(user.id)
          setFormData(prev => ({ ...prev, captain_id: user.id }))
        }
      } catch (error) {
        console.error('Error getting current user:', error)
      }
    }
    getCurrentUser()
  }, [])

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
        const error = await response.json()
        console.error('Error creating team:', error)
        alert(`Failed to create team: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating team:', error)
      alert('Failed to create team. Please try again.')
    } finally {
      setLoading(false)
    }
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
