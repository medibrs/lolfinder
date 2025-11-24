'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, User, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  created_at: string
  user_metadata?: any
  app_metadata?: any
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // This would require admin privileges - for now, we'll simulate
      // In a real implementation, you'd use the admin API or a secure endpoint
      const { data, error } = await supabase
        .from('players')
        .select('id, email, created_at, user_metadata, app_metadata')
      
      if (error) {
        console.error('Error fetching users:', error)
        return
      }
      
      setUsers(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    setUpdating(userId)
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin'
      
      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update role')
      }

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, app_metadata: { ...user.app_metadata, role: newRole } }
          : user
      ))
    } catch (error) {
      console.error('Error updating role:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>
          Manage user roles and permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-full">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge 
                  variant={user.app_metadata?.role === 'admin' ? 'default' : 'secondary'}
                  className="flex items-center gap-1"
                >
                  {user.app_metadata?.role === 'admin' ? (
                    <Crown className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  {user.app_metadata?.role || 'user'}
                </Badge>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAdminRole(user.id, user.app_metadata?.role || 'user')}
                  disabled={updating === user.id}
                >
                  {updating === user.id ? 'Updating...' : 
                   user.app_metadata?.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </Button>
              </div>
            </div>
          ))}
          
          {users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
