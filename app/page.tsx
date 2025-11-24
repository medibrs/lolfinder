import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="pt-16">
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-background to-card flex items-center justify-center px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-4 text-balance">
            Find Your <span className="text-primary">Perfect Team</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-6 text-balance">
            Join the ultimate League of Legends community. Create teams, compete in tournaments, and climb the ranks together.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href="/setup-profile">Create Profile</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/teams">Browse Teams</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tournaments">View Tournaments</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-2">Find Your Team</h3>
              <p className="text-muted-foreground">Browse players, send invitations, or request to join existing teams looking for members.</p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">⚔️</div>
              <h3 className="text-xl font-bold mb-2">Build Your Roster</h3>
              <p className="text-muted-foreground">Create teams, manage members, set open positions, and recruit the best players.</p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Compete Together</h3>
              <p className="text-muted-foreground">Register for tournaments, track your team's progress, and dominate the competition.</p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
