import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="pt-20">
      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-b from-background to-card flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-balance">
            Build Your <span className="text-primary">Tournament App</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 text-balance">
            Create your own League of Legends tournament platform. Manage players, teams, competitions, and dominate the scene.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
              <Link href="/auth">Create Your App</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/search">Explore Teams</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-bold mb-2">Launch Tournaments</h3>
              <p className="text-muted-foreground">Create and manage competitive tournaments with registration systems.</p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-bold mb-2">Team Management</h3>
              <p className="text-muted-foreground">Build rosters, track stats, and manage player profiles.</p>
            </Card>
            <Card className="bg-card border-border p-6">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-xl font-bold mb-2">Compete & Win</h3>
              <p className="text-muted-foreground">Join tournaments, track rankings, and claim victory.</p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
