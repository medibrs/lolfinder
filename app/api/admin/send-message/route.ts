import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Validation schema
const sendMessageSchema = z.object({
  user_id: z.string().uuid(),
  message: z.string().min(1),
  title: z.string().min(1).default('Message from Admin'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = sendMessageSchema.parse(body);

    // 1. Authenticate the user (Admin check)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin
    // Check app_metadata role or specific email bypass
    const isAdmin = user.app_metadata?.role === 'admin' || user.email === 'tiznit.sos@gmail.com';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 2. Use Service Role Client to bypass RLS for insertion
    // Note: We must use the SERVICE_ROLE_KEY here because typical RLS might prevent
    // inserting notifications for other users.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // 3. Insert notification
    const { error: insertError } = await adminSupabase
      .from('notifications')
      .insert({
        user_id: validatedData.user_id,
        type: 'admin_message',
        title: validatedData.title,
        message: validatedData.message,
        read: false,
        data: {
          from_admin: true,
          admin_id: user.id
        }
      });

    if (insertError) {
      console.error('Error inserting notification:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing request:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
