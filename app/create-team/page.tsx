'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

export default function CreateTeamPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ownerId: '',
  })

  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // API call would happen here: POST /teams
    console.log('Creating team:', formData)
    setSubmitted(true)
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
            <div>
              <label className="block text-sm font-medium mb-2">Team Name *</label>
              <Input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your team name"
                required
                className="bg-input border-border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your team..."
                rows={4}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground resize-none"
              />
            </div>

            <div className="bg-secondary/30 border border-border p-4 rounded-lg space-y-3">
              <h3 className="font-semibold">Next Steps</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-primary">1.</span>
                  <span>Create your team and become the team owner</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">2.</span>
                  <span>Search for and invite skilled players to join</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">3.</span>
                  <span>Register your complete team for tournaments</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                Create Team
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}
