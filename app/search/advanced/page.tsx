'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

const ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUP']
const TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster']

export default function AdvancedSearchPage() {
  const [filters, setFilters] = useState({
    searchQuery: '',
    searchType: 'all' as 'all' | 'players' | 'teams',
    role: '' as string,
    tier: '' as string,
    region: '' as string,
  })

  const mockResults = [
    { type: 'player', name: 'ShadowKing', role: 'TOP', tier: 'Platinum II', status: 'LFT' },
    { type: 'team', name: 'Shadow Legends', neededRoles: ['MID', 'ADC'] },
    { type: 'player', name: 'SwiftArrow', role: 'ADC', tier: 'Platinum I', status: 'LFT' },
  ]

  const filteredResults = mockResults.filter(result => {
    if (filters.searchType === 'players' && result.type === 'team') return false
    if (filters.searchType === 'teams' && result.type === 'player') return false
    return true
  })

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <Button asChild variant="outline" className="mb-8">
          <Link href="/search">← Back to Search</Link>
        </Button>

        <h1 className="text-4xl font-bold mb-8">Advanced Search</h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters */}
          <Card className="bg-card border-border p-6 lg:col-span-1 h-fit sticky top-24">
            <h3 className="font-bold mb-6">Filters</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Search Type</label>
                <select
                  value={filters.searchType}
                  onChange={(e) => setFilters({ ...filters, searchType: e.target.value as any })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm"
                >
                  <option value="all">All</option>
                  <option value="players">Players Only</option>
                  <option value="teams">Teams Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm"
                >
                  <option value="">Any Role</option>
                  {ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tier</label>
                <select
                  value={filters.tier}
                  onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm"
                >
                  <option value="">Any Tier</option>
                  {TIERS.map(tier => (
                    <option key={tier} value={tier}>{tier}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm"
                >
                  <option value="">Any Region</option>
                  <option value="NA">North America</option>
                  <option value="EUW">Europe West</option>
                  <option value="EUNE">Europe Nordic</option>
                  <option value="KR">Korea</option>
                </select>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 mt-6">
                Apply Filters
              </Button>
            </div>
          </Card>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="mb-6">
              <Input
                placeholder="Search name or team..."
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-4">
              {filteredResults.length > 0 ? (
                filteredResults.map((result, idx) => (
                  <Card key={idx} className="bg-card border-border p-6 hover:border-primary transition">
                    {result.type === 'player' ? (
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold mb-2">{result.name}</h3>
                          <p className="text-primary font-semibold mb-1">{result.role}</p>
                          <p className="text-muted-foreground text-sm">{result.tier}</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-medium">
                            LFT
                          </span>
                          <Button size="sm" className="bg-primary hover:bg-primary/90">
                            View Profile
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-bold mb-3">{result.name}</h3>
                        <div className="flex gap-2 mb-3">
                          {result.neededRoles?.map(role => (
                            <span key={role} className="bg-accent/20 text-accent px-2 py-1 rounded text-sm">
                              {role}
                            </span>
                          ))}
                        </div>
                        <Button size="sm" className="bg-primary hover:bg-primary/90">
                          View Team
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              ) : (
                <Card className="bg-card border-border p-12 text-center">
                  <p className="text-muted-foreground">No results found. Try adjusting your filters.</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
