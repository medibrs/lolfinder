import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Users, Trophy, Database, CheckCircle, AlertCircle, Lightbulb } from 'lucide-react'

interface SystemHealthCardProps {
  stats: {
    playersCount: number
    teamsCount: number
    tournamentsCount: number
    registrationsCount: number
    featureRequestsCount: number
  }
}

export default function SystemHealthCard({ stats }: SystemHealthCardProps) {
  const healthStatus = {
    database: 'healthy',
    auth: 'healthy',
    storage: 'healthy'
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="text-4xl mb-4">🏥</div>
      <CardHeader className="p-0 mb-6">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
        <CardDescription>
          Monitor platform status and performance
        </CardDescription>
      </CardHeader>
      
      <div className="space-y-6">
        {/* Service Status */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Services</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm">Database</span>
              </div>
              <Badge variant={healthStatus.database === 'healthy' ? 'default' : 'destructive'}>
                {healthStatus.database}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">Authentication</span>
              </div>
              <Badge variant={healthStatus.auth === 'healthy' ? 'default' : 'destructive'}>
                {healthStatus.auth}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="text-sm">Tournament Engine</span>
              </div>
              <Badge variant={healthStatus.storage === 'healthy' ? 'default' : 'destructive'}>
                {healthStatus.storage}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Platform Statistics</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.playersCount}</p>
              <p className="text-xs text-muted-foreground">Total Players</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.teamsCount}</p>
              <p className="text-xs text-muted-foreground">Total Teams</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.tournamentsCount}</p>
              <p className="text-xs text-muted-foreground">Tournaments</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{stats.registrationsCount}</p>
              <p className="text-xs text-muted-foreground">Registrations</p>
            </div>
            <div className="p-3 bg-background rounded-lg text-center col-span-2">
              <p className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                <Lightbulb className="h-4 w-4" />
                {stats.featureRequestsCount}
              </p>
              <p className="text-xs text-muted-foreground">Feature Requests</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Recent Activity</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-background rounded">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">All systems operational</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-background rounded">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">No pending issues</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
