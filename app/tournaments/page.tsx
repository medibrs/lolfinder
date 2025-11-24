'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function TournamentsPage() {
  // Mock tournament data
  const mockTournaments = [
    {
      id: 1,
      name: 'Spring Circuit 2025',
      status: 'registration-open',
      startDate: 'March 15, 2025',
      prizePool: '$50,000',
      description: 'The biggest spring tournament of the year. Open registration for teams of all skill levels.',
    },
    {
      id: 2,
      name: 'Challenger Cup',
      status: 'in-progress',
      startDate: 'Jan 20, 2025',
      prizePool: '$25,000',
      description: 'A competitive tournament for rising talent.',
    },
    {
      id: 3,
      name: 'Summer Showdown',
      status: 'coming-soon',
      startDate: 'June 1, 2025',
      prizePool: '$100,000',
      description: 'The championship event. Prepare your roster now!',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration-open':
        return 'bg-accent text-accent-foreground'
      case 'in-progress':
        return 'bg-primary text-primary-foreground'
      case 'coming-soon':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusText = (status: string) => {
    return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-2">Tournaments</h1>
        <p className="text-muted-foreground mb-8">Browse and register for upcoming tournaments</p>

        <div className="grid grid-cols-1 gap-6">
          {mockTournaments.map(tournament => (
            <Card key={tournament.id} className="bg-card border-border p-8 hover:border-primary transition">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                <div>
                  <h3 className="text-3xl font-bold mb-2">{tournament.name}</h3>
                  <p className="text-muted-foreground mb-4">{tournament.description}</p>
                </div>
                <span className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap ${getStatusColor(tournament.status)}`}>
                  {getStatusText(tournament.status)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 py-4 border-y border-border">
                <div>
                  <p className="text-muted-foreground text-sm">Start Date</p>
                  <p className="font-semibold">{tournament.startDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Prize Pool</p>
                  <p className="font-semibold text-accent">{tournament.prizePool}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Format</p>
                  <p className="font-semibold">Best of 5</p>
                </div>
              </div>

              <Button className="bg-primary hover:bg-primary/90">
                {tournament.status === 'registration-open' ? 'Register Team' : 'View Details'}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
