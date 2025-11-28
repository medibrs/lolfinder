import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// Validation schema for feature requests
const createFeatureRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
  use_case: z.string().optional(),
})

// POST /api/feature-requests - Create a new feature request
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = createFeatureRequestSchema.safeParse(body)

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
    }

    const { title, description, category, priority, use_case } = validationResult.data

    // Check if user has a player profile
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('id', user.id)
      .single()

    if (playerError || !playerData) {
      return NextResponse.json({ error: 'Player profile not found. Please complete your profile first.' }, { status: 404 })
    }

    // Check for duplicate titles from the same user
    const { data: existingRequest, error: duplicateError } = await supabase
      .from('feature_requests')
      .select('id')
      .eq('user_id', playerData.id)
      .eq('title', title)
      .single()

    if (existingRequest) {
      return NextResponse.json({ error: 'You have already submitted a feature request with this title' }, { status: 409 })
    }

    // Create the feature request
    const { data: featureRequest, error: insertError } = await supabase
      .from('feature_requests')
      .insert({
        user_id: playerData.id,
        title,
        description,
        category,
        priority,
        use_case,
        status: 'Submitted',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating feature request:', insertError)
      return NextResponse.json({ error: 'Failed to create feature request' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Feature request submitted successfully',
      feature_request: featureRequest
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in POST /api/feature-requests:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

// GET /api/feature-requests - List feature requests (public)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const userId = searchParams.get('user_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    // Build query
    let query = supabase
      .from('feature_requests')
      .select(`
        *,
        players!feature_requests_user_id_fkey (
          summoner_name
        ),
        feature_categories (
          name,
          color,
          icon
        )
      `, { count: 'exact' })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // Apply sorting
    const validSortFields = ['created_at', 'updated_at', 'vote_count', 'comment_count', 'title']
    const validSortOrders = ['asc', 'desc']
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: featureRequests, error, count } = await query

    if (error) {
      console.error('Error fetching feature requests:', error)
      return NextResponse.json({ error: 'Failed to fetch feature requests' }, { status: 500 })
    }

    return NextResponse.json({
      feature_requests: featureRequests,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/feature-requests:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
