# Supabase Authentication Guide

Yes! Supabase handles **authentication** and **session management** automatically. This guide shows you how to implement it.

## 🔐 What Supabase Auth Provides

✅ **Email/Password Authentication**  
✅ **OAuth Providers** (Google, GitHub, Discord, etc.)  
✅ **Magic Links** (passwordless login)  
✅ **Session Management** (automatic token refresh)  
✅ **Row Level Security** (database-level authorization)  
✅ **User Management** (built-in user table)  
✅ **Password Reset** (email-based recovery)  
✅ **Email Verification**  

## Quick Start

### 1. Enable Authentication in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider (enabled by default)
4. Optionally enable OAuth providers (Google, Discord, etc.)

### 2. Install Additional Dependencies

```bash
pnpm add @supabase/ssr
```

### 3. Update Supabase Client

We need two clients: one for client-side and one for server-side.

#### Client-Side Client (Browser)

```typescript
// lib/supabase-client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### Server-Side Client (API Routes, Server Components)

```typescript
// lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

---

## Authentication Components

### Sign Up Form

```typescript
// app/auth/signup/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Check your email for verification link!')
      router.push('/auth/login')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSignUp}>
      <h1>Sign Up</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

### Login Form

```typescript
// app/auth/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleLogin}>
      <h1>Login</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Login'}
      </button>
    </form>
  )
}
```

### Logout Button

```typescript
// components/logout-button.tsx
'use client'

import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  )
}
```

### Auth Callback Handler

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

---

## Protecting API Routes

### Middleware for Protected Routes

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect API routes
  if (request.nextUrl.pathname.startsWith('/api/') && !user) {
    // Allow public endpoints
    const publicEndpoints = ['/api/players', '/api/teams', '/api/tournaments', '/api/search']
    const isPublic = publicEndpoints.some(endpoint => 
      request.nextUrl.pathname.startsWith(endpoint) && request.method === 'GET'
    )
    
    if (!isPublic) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Protect dashboard pages
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Protected API Route Example

```typescript
// app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  
  // Now create player with user_id
  const { data, error } = await supabase
    .from('players')
    .insert([{
      ...body,
      user_id: user.id, // Link player to authenticated user
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

---

## Update Database Schema for Auth

Add `user_id` to link records to authenticated users:

```sql
-- Add user_id to players table
ALTER TABLE players
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_players_user_id ON players(user_id);

-- Update RLS policies to check user ownership
DROP POLICY IF EXISTS "Enable insert access for all users" ON players;
DROP POLICY IF EXISTS "Enable update access for all users" ON players;
DROP POLICY IF EXISTS "Enable delete access for all users" ON players;

-- New policies with authentication
CREATE POLICY "Enable insert for authenticated users only" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users based on user_id" ON players
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for users based on user_id" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- Keep read access public
CREATE POLICY "Enable read access for all users" ON players
  FOR SELECT USING (true);
```

---

## Getting Current User

### In Client Components

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (!user) return <div>Not logged in</div>

  return (
    <div>
      <h1>Profile</h1>
      <p>Email: {user.email}</p>
      <p>User ID: {user.id}</p>
    </div>
  )
}
```

### In Server Components

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.email}!</p>
    </div>
  )
}
```

---

## OAuth Providers

### Enable Discord OAuth (Perfect for Gaming!)

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Discord**
3. Add your Discord OAuth credentials:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create new application
   - Add OAuth2 redirect URL: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret to Supabase

### Login with Discord

```typescript
'use client'

import { createClient } from '@/lib/supabase-client'

export function DiscordLoginButton() {
  const supabase = createClient()

  const handleDiscordLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      alert(error.message)
    }
  }

  return (
    <button onClick={handleDiscordLogin}>
      Login with Discord
    </button>
  )
}
```

---

## Session Management

Supabase handles sessions automatically:

- ✅ **Automatic token refresh** - No manual refresh needed
- ✅ **Secure cookies** - HttpOnly, Secure flags
- ✅ **Cross-tab sync** - Login in one tab, all tabs update
- ✅ **Persistent sessions** - Users stay logged in

### Check Session Status

```typescript
const { data: { session } } = await supabase.auth.getSession()

if (session) {
  console.log('User is logged in')
  console.log('Access token:', session.access_token)
  console.log('Expires at:', session.expires_at)
}
```

---

## Complete Auth Flow Example

```typescript
// app/auth/auth-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

### Use in Components

```typescript
'use client'

import { useAuth } from '@/app/auth/auth-provider'

export function UserMenu() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) {
    return <a href="/auth/login">Login</a>
  }

  return (
    <div>
      <span>{user.email}</span>
      <button onClick={signOut}>Logout</button>
    </div>
  )
}
```

---

## Environment Variables

No additional environment variables needed! Authentication uses the same Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Benefits of Supabase Auth

✅ **No backend code needed** - Everything handled by Supabase  
✅ **Secure by default** - Industry-standard security  
✅ **Automatic session refresh** - No manual token management  
✅ **Multiple auth methods** - Email, OAuth, Magic Links  
✅ **Built-in user management** - User table and admin panel  
✅ **Row Level Security** - Database-level authorization  
✅ **Email templates** - Customizable verification/reset emails  
✅ **Free tier** - 50,000 monthly active users  

---

## Next Steps

1. ✅ Install `@supabase/ssr`
2. ✅ Create auth client files
3. ✅ Add sign up/login pages
4. ✅ Update database schema with `user_id`
5. ✅ Update RLS policies
6. ✅ Protect API routes
7. ✅ Add middleware
8. 🎮 Enable Discord OAuth (recommended for gaming platform!)

---

## Summary

**Yes, Supabase handles everything:**
- ✅ User registration and login
- ✅ Session management (automatic)
- ✅ Token refresh (automatic)
- ✅ Password reset
- ✅ Email verification
- ✅ OAuth providers
- ✅ User management

**You just need to:**
1. Call `supabase.auth.signUp()` / `signInWithPassword()`
2. Supabase handles the rest automatically!

No JWT management, no session stores, no complex auth logic needed! 🎉
