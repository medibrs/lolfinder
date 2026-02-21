import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.redirect(`${origin}/auth?error=No+authorization+code+provided`)
    }

    const clientId = process.env.FORTYTWO_CLIENT_ID
    const clientSecret = process.env.FORTYTWO_CLIENT_SECRET
    const redirectUri = `${origin}/api/auth/42/callback`

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(`${origin}/auth?error=42+OAuth+server+misconfigured`)
    }

    try {
        // 1. Exchange OAuth code for 42 access token
        const tokenRes = await fetch('https://api.intra.42.fr/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri
            })
        })

        const tokenData = await tokenRes.json()
        if (!tokenRes.ok) {
            console.error('Failed to retrieve 42 token:', tokenData)
            return NextResponse.redirect(`${origin}/auth?error=Failed+to+authenticate+with+42`)
        }

        // 2. Fetch User Profile from 42 /v2/me Endpoint
        const userRes = await fetch('https://api.intra.42.fr/v2/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })

        const userData = await userRes.json()
        if (!userRes.ok) {
            throw new Error('Failed to fetch 42 user profile data')
        }

        const email = userData.email
        const username = userData.login // This is their 42 intra name
        const avatarUrl = userData.image?.link || userData.image?.url

        if (!email) {
            return NextResponse.redirect(`${origin}/auth?error=Your+42+account+must+have+an+associated+email`)
        }

        // 3. Initialize Supabase Admin strictly server-side, bypassing RLS to manage accounts securely.
        // Ensure you have SUPABASE_SERVICE_ROLE_KEY present in your environment
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 4. Ensure User Exists in Supabase GoTrue Auth
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true, // Auto confirm so they don't have to verify via email
            user_metadata: {
                provider: '42',
                username: username,
                avatar_url: avatarUrl,
                full_name: userData.displayname
            }
        })

        // It's completely fine if the user already exists (they've logged in before)
        if (createError && !createError.message.includes('already exists') && !createError.message.includes('already registered')) {
            console.error("42 Auth Provision Error:", createError)
            return NextResponse.redirect(`${origin}/auth?error=Failed+to+provision+Supabase+user`)
        }

        // 5. Generate a backend magic link session
        // This allows us to log into a user programmatically via an OTP token without ever seeing their password
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email
        })

        if (linkError || !linkData.properties?.hashed_token) {
            console.error("42 MagicLink Generation Error:", linkError)
            return NextResponse.redirect(`${origin}/auth?error=Failed+to+generate+GoTrue+session`)
        }

        // 6. Sign them into the local NextJS SSR Cookie Storage
        const ssrSupabase = await createSSRClient()
        const { error: verifyError } = await ssrSupabase.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'magiclink'
        })

        if (verifyError) {
            console.error("42 OTP Verify Error:", verifyError)
            return NextResponse.redirect(`${origin}/auth?error=Failed+to+verify+local+session`)
        }

        // Profit! They have a fully authenticated Supabase session hooked to 42.
        return NextResponse.redirect(`${origin}/setup-profile`)

    } catch (error) {
        console.error('Unexpected 42 authentication bridge error:', error)
        return NextResponse.redirect(`${origin}/auth?error=Unexpected+authentication+error`)
    }
}
