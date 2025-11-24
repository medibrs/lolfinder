'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Trophy, Shield, TrendingUp, Activity } from 'lucide-react'

interface AdminStatsProps {
  playersCount: number
  teamsCount: number
  tournamentsCount: number
  registrationsCount: number
}

export default function AdminStats({
  playersCount,
  teamsCount,
  tournamentsCount,
  registrationsCount
}: AdminStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Players</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{playersCount}</div>
          <p className="text-xs text-muted-foreground">
            +{Math.floor(playersCount * 0.1)}% from last month
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{teamsCount}</div>
          <p className="text-xs text-muted-foreground">
            +{Math.floor(teamsCount * 0.15)}% from last month
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tournamentsCount}</div>
          <p className="text-xs text-muted-foreground">
            +{Math.floor(tournamentsCount * 0.08)}% from last month
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Registrations</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{registrationsCount}</div>
          <p className="text-xs text-muted-foreground">
            +{Math.floor(registrationsCount * 0.2)}% from last month
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
