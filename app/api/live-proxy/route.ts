import { NextRequest, NextResponse } from 'next/server'

// Server-side relay: browser → this API → remote proxy server
// This avoids HTTPS→HTTP mixed content issues
export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get('host')

  if (!host) {
    return NextResponse.json({ error: 'Missing host parameter' }, { status: 400 })
  }

  // Validate host format (ip:port or ip — default port 4000)
  const hostPattern = /^[\d.]+(?::\d+)?$/
  if (!hostPattern.test(host)) {
    return NextResponse.json({ error: 'Invalid host format. Use IP:PORT or just IP' }, { status: 400 })
  }

  const target = host.includes(':') ? host : `${host}:4000`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`http://${target}/live`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Proxy returned ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Connection timed out (3s)' }, { status: 504 })
    }
    return NextResponse.json(
      { error: `Cannot reach proxy at ${target}: ${err.message}` },
      { status: 502 }
    )
  }
}
