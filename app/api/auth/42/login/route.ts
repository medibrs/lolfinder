import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { origin } = new URL(request.url)

    const clientId = process.env.FORTYTWO_CLIENT_ID
    if (!clientId) {
        return NextResponse.json({ error: 'FORTYTWO_CLIENT_ID not configured in the server' }, { status: 500 })
    }

    // Construct the redirect URL where 42 will send the user back to
    const redirectUri = `${origin}/api/auth/42/callback`

    // Construct 42 School OAuth URL
    const authUrl = new URL('https://api.intra.42.fr/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'public')

    return NextResponse.redirect(authUrl.toString())
}
