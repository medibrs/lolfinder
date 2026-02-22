import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
    try {
        const { userId } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

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

        // Check if current user is admin
        const { data: { user: currentUser } } = await supabase.auth.getUser()

        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if current user has admin role
        if (currentUser.app_metadata?.role !== 'admin') {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        // Get a service role client to bypass RLS for deletion
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Service role key not configured.' }, { status: 500 })
        }

        const adminClient = await import('@supabase/supabase-js').then(mod => mod.createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        ))

        // 1. Check if user has a team and handle it
        const { data: playerProfile } = await adminClient
            .from('players')
            .select('team_id')
            .eq('id', userId)
            .single()

        if (playerProfile?.team_id) {
            // If user is a captain, we might want to handle it (e.g., delete team or error out)
            // For safety, let's just delete them from the team by setting their team_id to null
            // Actually if they are entirely deleted physically, the foreign keys should handle the rest
            // Let's delete join requests for this player
            await adminClient.from('team_join_requests').delete().eq('player_id', userId)

            // Let's also check if they are the captain
            const { data: teamData } = await adminClient
                .from('teams')
                .select('*')
                .eq('id', playerProfile.team_id)
                .single()

            if (teamData && teamData.captain_id === userId) {
                // If captain, we either assign random member or delete team. 
                // For profile deletion, it's safest to disband team to prevent orphan teams.
                await adminClient.from('team_invitations').delete().eq('team_id', teamData.id)
                await adminClient.from('team_join_requests').delete().eq('team_id', teamData.id)

                // Update other members to have NULL team_id
                await adminClient.from('players').update({ team_id: null }).eq('team_id', teamData.id)

                // Delete the team itself
                await adminClient.from('teams').delete().eq('id', teamData.id)
            }
        }

        // Clean up notifications sent TO the user before deleting profile
        await adminClient.from('notifications').delete().eq('user_id', userId)

        // Ensure all invitations sent to this player are deleted
        await adminClient.from('team_invitations').delete().eq('invited_player_id', userId)

        // Finally, completely delete the player record
        const { error: deleteProfileError } = await adminClient
            .from('players')
            .delete()
            .eq('id', userId)

        if (deleteProfileError) {
            console.error('Error deleting player profile:', deleteProfileError)
            return NextResponse.json({ error: 'Failed to delete player profile: ' + deleteProfileError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Player profile deleted successfully.' })
    } catch (error: any) {
        console.error('Server error deleting profile:', error)
        return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 })
    }
}
