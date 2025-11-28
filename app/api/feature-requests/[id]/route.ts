import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// Validation schema for updating feature requests
const updateFeatureRequestSchema = z.object({
  status: z.enum(['Submitted', 'Under Review', 'Planned', 'In Progress', 'Completed', 'Rejected']),
  admin_response: z.string().optional(),
})

// PUT /api/feature-requests/[id] - Update a feature request (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    // Get the current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Check if user is an admin
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('role')
      .eq('id', user.id)
      .single()

    if (playerError || !playerData || playerData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = updateFeatureRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
    }

    const { status, admin_response } = validationResult.data

    // Update the feature request
    const { data: featureRequest, error: updateError } = await supabase
      .from('feature_requests')
      .update({
        status,
        admin_response: admin_response || null,
        admin_id: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating feature request:', updateError)
      
      // If table doesn't exist
      if (updateError.code === 'PGRST116' || updateError.message.includes('does not exist')) {
        return NextResponse.json({ error: 'Feature requests are not available at this time' }, { status: 503 })
      }
      
      return NextResponse.json({ error: 'Failed to update feature request' }, { status: 500 })
    }

    if (!featureRequest) {
      return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Feature request updated successfully',
      feature_request: featureRequest
    })

  } catch (error) {
    console.error('Unexpected error in PUT /api/feature-requests/[id]:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// GET /api/feature-requests/[id] - Get a single feature request (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    // Get the current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Check if user is an admin
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('role')
      .eq('id', user.id)
      .single()

    if (playerError || !playerData || playerData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the feature request with user details
    const { data: featureRequest, error } = await supabase
      .from('feature_requests')
      .select(`
        *,
        players!feature_requests_user_id_fkey (
          summoner_name
        )
      `)
      .eq('id', requestId)
      .single()

    if (error) {
      console.error('Error fetching feature request:', error)
      
      // If table doesn't exist
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return NextResponse.json({ error: 'Feature requests are not available at this time' }, { status: 503 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch feature request' }, { status: 500 })
    }

    if (!featureRequest) {
      return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
    }

    return NextResponse.json({
      feature_request: featureRequest
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/feature-requests/[id]:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// DELETE /api/feature-requests/[id] - Delete a feature request (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    // Get the current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Check if user is an admin
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('role')
      .eq('id', user.id)
      .single()

    if (playerError || !playerData || playerData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete the feature request
    const { error: deleteError } = await supabase
      .from('feature_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('Error deleting feature request:', deleteError)
      
      // If table doesn't exist
      if (deleteError.code === 'PGRST116' || deleteError.message.includes('does not exist')) {
        return NextResponse.json({ error: 'Feature requests are not available at this time' }, { status: 503 })
      }
      
      return NextResponse.json({ error: 'Failed to delete feature request' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Feature request deleted successfully'
    })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/feature-requests/[id]:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
