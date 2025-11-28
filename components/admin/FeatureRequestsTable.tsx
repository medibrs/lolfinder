'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, Filter, Eye, MessageSquare, CheckCircle, Clock, XCircle, AlertTriangle, Calendar, User, ThumbsUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FeatureRequest {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Submitted' | 'Under Review' | 'Planned' | 'In Progress' | 'Completed' | 'Rejected'
  use_case?: string
  admin_response?: string
  admin_id?: string
  vote_count: number
  comment_count: number
  created_at: string
  updated_at: string
  players?: {
    summoner_name: string
  }
}

const STATUS_COLORS = {
  'Submitted': 'bg-blue-500',
  'Under Review': 'bg-yellow-500', 
  'Planned': 'bg-purple-500',
  'In Progress': 'bg-orange-500',
  'Completed': 'bg-green-500',
  'Rejected': 'bg-red-500'
}

const STATUS_ICONS = {
  'Submitted': Clock,
  'Under Review': AlertTriangle,
  'Planned': Calendar,
  'In Progress': MessageSquare,
  'Completed': CheckCircle,
  'Rejected': XCircle
}

const PRIORITY_COLORS = {
  'Low': 'bg-gray-500',
  'Medium': 'bg-yellow-500',
  'High': 'bg-red-500'
}

const CATEGORIES = {
  'UI/UX': { icon: '🎨', color: '#6366f1' },
  'Gameplay': { icon: '🎮', color: '#10b981' },
  'Teams': { icon: '👥', color: '#f59e0b' },
  'Tournaments': { icon: '🏆', color: '#ef4444' },
  'Profile': { icon: '👤', color: '#8b5cf6' },
  'Performance': { icon: '⚡', color: '#06b6d4' },
  'Other': { icon: '📋', color: '#6b7280' }
}

export default function FeatureRequestsTable() {
  const [requests, setRequests] = useState<FeatureRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<FeatureRequest | null>(null)
  const [responseText, setResponseText] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const supabase = createClient()

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/feature-requests')
      const data = await response.json()
      
      if (response.ok) {
        setRequests(data.feature_requests || [])
      } else {
        console.error('Failed to fetch feature requests:', data.error)
      }
    } catch (error) {
      console.error('Error fetching feature requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const updateRequestStatus = async (requestId: string, newStatus: string, response?: string) => {
    try {
      setUpdatingStatus(requestId)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`/api/feature-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          status: newStatus,
          admin_response: response 
        }),
      })

      if (response.ok) {
        await fetchRequests() // Refresh the list
        setSelectedRequest(null)
        setResponseText('')
      } else {
        const errorData = await response.json()
        alert(`Failed to update: ${errorData.error}`)
      }
    } catch (error) {
      alert('Failed to update request status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || request.category === categoryFilter
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesCategory && matchesPriority
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.keys(CATEGORIES).map(category => (
              <SelectItem key={category} value={category}>
                {CATEGORIES[category as keyof typeof CATEGORIES].icon} {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No feature requests found matching your criteria.
          </div>
        ) : (
          filteredRequests.map((request) => {
            const StatusIcon = STATUS_ICONS[request.status]
            const categoryInfo = CATEGORIES[request.category as keyof typeof CATEGORIES]
            
            return (
              <Card key={request.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{categoryInfo?.icon}</span>
                        <h3 className="font-semibold text-lg">{request.title}</h3>
                        <Badge className={`${PRIORITY_COLORS[request.priority]} text-white`}>
                          {request.priority}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {request.players?.summoner_name || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(request.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-4 w-4" />
                          {request.vote_count} votes
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`${STATUS_COLORS[request.status]} text-white flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {request.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {request.description}
                  </p>

                  {/* Use Case */}
                  {request.use_case && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm font-medium mb-1">Use Case:</p>
                      <p className="text-sm text-muted-foreground">{request.use_case}</p>
                    </div>
                  )}

                  {/* Admin Response */}
                  {request.admin_response && (
                    <Alert>
                      <AlertDescription>
                        <strong>Admin Response:</strong> {request.admin_response}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request)
                              setResponseText(request.admin_response || '')
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <span className="text-lg">{categoryInfo?.icon}</span>
                              {request.title}
                            </DialogTitle>
                            <DialogDescription>
                              Feature request details and management
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            {/* Request Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium">Category</p>
                                <p>{categoryInfo?.icon} {request.category}</p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Priority</p>
                                <Badge className={`${PRIORITY_COLORS[request.priority]} text-white`}>
                                  {request.priority}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Status</p>
                                <Badge className={`${STATUS_COLORS[request.status]} text-white`}>
                                  {request.status}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Submitted</p>
                                <p>{formatDate(request.created_at)}</p>
                              </div>
                            </div>

                            {/* Description */}
                            <div>
                              <p className="text-sm font-medium mb-2">Description</p>
                              <p className="text-sm bg-muted/50 p-3 rounded-md">{request.description}</p>
                            </div>

                            {/* Use Case */}
                            {request.use_case && (
                              <div>
                                <p className="text-sm font-medium mb-2">Use Case</p>
                                <p className="text-sm bg-muted/50 p-3 rounded-md">{request.use_case}</p>
                              </div>
                            )}

                            {/* Admin Response */}
                            <div>
                              <p className="text-sm font-medium mb-2">Admin Response</p>
                              <Textarea
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder="Add your response here..."
                                rows={3}
                              />
                            </div>

                            {/* Status Update Actions */}
                            <div className="space-y-3">
                              <p className="text-sm font-medium">Update Status</p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant={request.status === 'Under Review' ? 'default' : 'outline'}
                                  onClick={() => updateRequestStatus(request.id, 'Under Review', responseText)}
                                  disabled={updatingStatus === request.id}
                                >
                                  Under Review
                                </Button>
                                <Button
                                  size="sm"
                                  variant={request.status === 'Planned' ? 'default' : 'outline'}
                                  onClick={() => updateRequestStatus(request.id, 'Planned', responseText)}
                                  disabled={updatingStatus === request.id}
                                >
                                  Planned
                                </Button>
                                <Button
                                  size="sm"
                                  variant={request.status === 'In Progress' ? 'default' : 'outline'}
                                  onClick={() => updateRequestStatus(request.id, 'In Progress', responseText)}
                                  disabled={updatingStatus === request.id}
                                >
                                  In Progress
                                </Button>
                                <Button
                                  size="sm"
                                  variant={request.status === 'Completed' ? 'default' : 'outline'}
                                  onClick={() => updateRequestStatus(request.id, 'Completed', responseText)}
                                  disabled={updatingStatus === request.id}
                                >
                                  Completed
                                </Button>
                                <Button
                                  size="sm"
                                  variant={request.status === 'Rejected' ? 'destructive' : 'outline'}
                                  onClick={() => updateRequestStatus(request.id, 'Rejected', responseText)}
                                  disabled={updatingStatus === request.id}
                                >
                                  Rejected
                                </Button>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground pt-4 border-t">
        Showing {filteredRequests.length} of {requests.length} feature requests
      </div>
    </div>
  )
}
