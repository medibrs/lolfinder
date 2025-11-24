# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                      (Next.js Pages)                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Home    │  │ Players  │  │  Teams   │  │Tournaments│   │
│  │  Page    │  │   Page   │  │   Page   │  │   Page    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬──────┘   │
│       │             │              │              │          │
│       └─────────────┴──────────────┴──────────────┘          │
│                          │                                   │
│                          │ fetch()                           │
│                          ▼                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                          │    Next.js API Routes             │
│                          │    (Serverless Functions)         │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              API Route Handlers                      │    │
│  │                                                      │    │
│  │  /api/players/*      /api/teams/*                   │    │
│  │  /api/tournaments/*  /api/search                    │    │
│  │  /api/registrations/*                               │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                    │
│                         │ Supabase Client                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            lib/supabase.ts                          │    │
│  │         (Supabase Client Instance)                  │    │
│  └──────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              PostgreSQL Database                   │     │
│  │                                                    │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │     │
│  │  │ players  │  │  teams   │  │ tournaments  │    │     │
│  │  └──────────┘  └──────────┘  └──────────────┘    │     │
│  │                                                    │     │
│  │  ┌──────────────────────────────────────┐        │     │
│  │  │   tournament_registrations           │        │     │
│  │  └──────────────────────────────────────┘        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Row Level Security (RLS)                 │     │
│  │              + Policies                            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Real-time Subscriptions (Optional)         │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Player

```
User fills form
     │
     ▼
Frontend (create-player page)
     │
     │ POST /api/players
     │ { summoner_name, discord, role, tier, ... }
     ▼
API Route Handler (app/api/players/route.ts)
     │
     │ 1. Validate with Zod
     │ 2. Check required fields
     ▼
Supabase Client (lib/supabase.ts)
     │
     │ supabase.from('players').insert([data])
     ▼
Supabase PostgreSQL
     │
     │ 1. Check RLS policies
     │ 2. Insert into players table
     │ 3. Generate UUID
     │ 4. Set timestamps
     ▼
Response
     │
     │ { id, summoner_name, discord, ... }
     ▼
Frontend updates UI
```

### Searching for Players

```
User enters search criteria
     │
     ▼
Frontend (search page)
     │
     │ GET /api/search?type=player&role=Mid&tier=Gold
     ▼
API Route Handler (app/api/search/route.ts)
     │
     │ 1. Parse query parameters
     │ 2. Build Supabase query
     ▼
Supabase Client
     │
     │ supabase.from('players')
     │   .select('*')
     │   .eq('main_role', 'Mid')
     │   .eq('tier', 'Gold')
     ▼
Supabase PostgreSQL
     │
     │ 1. Execute query with indexes
     │ 2. Apply RLS policies
     │ 3. Return results
     ▼
Response
     │
     │ [{ id, summoner_name, ... }, ...]
     ▼
Frontend displays results
```

## Database Relationships

```
┌─────────────────┐
│    players      │
│─────────────────│
│ id (PK)         │◄────┐
│ summoner_name   │     │
│ discord         │     │
│ main_role       │     │
│ tier            │     │
│ team_id (FK)    │─┐   │
└─────────────────┘ │   │
                    │   │
                    │   │ captain_id
                    │   │
                    ▼   │
┌─────────────────┐     │
│     teams       │─────┘
│─────────────────│
│ id (PK)         │◄────┐
│ name            │     │
│ captain_id (FK) │     │
│ open_positions  │     │
│ tier            │     │
└─────────────────┘     │
                        │
                        │ team_id
                        │
                        │
┌──────────────────────┐│
│ tournament_          ││
│ registrations        ││
│──────────────────────││
│ id (PK)              ││
│ tournament_id (FK)   │┼──┐
│ team_id (FK)         │┘  │
│ status               │   │
└──────────────────────┘   │
                           │
                           │
                           ▼
                    ┌─────────────────┐
                    │  tournaments    │
                    │─────────────────│
                    │ id (PK)         │
                    │ name            │
                    │ start_date      │
                    │ max_teams       │
                    └─────────────────┘
```

## API Route Structure

```
app/api/
│
├── players/
│   ├── route.ts                    # GET, POST /api/players
│   └── [id]/
│       └── route.ts                # GET, PUT, DELETE /api/players/:id
│
├── teams/
│   ├── route.ts                    # GET, POST /api/teams
│   └── [id]/
│       ├── route.ts                # GET, PUT, DELETE /api/teams/:id
│       └── members/
│           ├── route.ts            # POST /api/teams/:id/members
│           └── [playerId]/
│               └── route.ts        # DELETE /api/teams/:id/members/:playerId
│
├── tournaments/
│   ├── route.ts                    # GET, POST /api/tournaments
│   └── [id]/
│       ├── route.ts                # GET, PUT, DELETE /api/tournaments/:id
│       ├── register/
│       │   └── route.ts            # POST /api/tournaments/:id/register
│       └── registrations/
│           └── route.ts            # GET /api/tournaments/:id/registrations
│
├── registrations/
│   └── [id]/
│       └── route.ts                # GET, PUT /api/registrations/:id
│
└── search/
    └── route.ts                    # GET /api/search
```

## Request/Response Flow

### Successful Request

```
Client Request
     │
     ▼
Next.js API Route
     │
     ├─► Validate Input (Zod)
     │   ├─► Valid ✓
     │   └─► Invalid ✗ → 400 Bad Request
     │
     ▼
Supabase Client
     │
     ├─► Query Database
     │   ├─► Success ✓
     │   └─► Error ✗ → 500 Server Error
     │
     ▼
Format Response
     │
     ▼
Return JSON
     │
     ▼
Client Receives Data
```

### Error Handling

```
Request
  │
  ▼
Try Block
  │
  ├─► Zod Validation Error
  │   └─► Return 400 { error, details }
  │
  ├─► Supabase Error
  │   ├─► Not Found (PGRST116)
  │   │   └─► Return 404 { error }
  │   └─► Other Error
  │       └─► Return 500 { error }
  │
  └─► Unexpected Error
      └─► Return 500 { error: "Internal server error" }
```

## Deployment Architecture

### Development
```
localhost:3000
     │
     ├─► Frontend Pages
     ├─► API Routes
     └─► Supabase Cloud
```

### Production (Vercel)
```
your-app.vercel.app
     │
     ├─► Static Pages (CDN)
     ├─► API Routes (Serverless Functions)
     │   └─► Auto-scaling
     └─► Supabase Cloud
         └─► PostgreSQL + Storage + Auth
```

## Security Layers

```
┌────────────────────────────────────────┐
│         Client Request                 │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│    Next.js API Route Handler           │
│    • Input Validation (Zod)            │
│    • Type Checking (TypeScript)        │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│       Supabase Client                  │
│    • API Key Authentication            │
│    • HTTPS Encryption                  │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│      Supabase Database                 │
│    • Row Level Security (RLS)          │
│    • Policies                          │
│    • Foreign Key Constraints           │
│    • Data Validation                   │
└────────────────────────────────────────┘
```

## Performance Optimizations

### Database Level
- ✅ Indexes on frequently queried columns
- ✅ Foreign key relationships
- ✅ Efficient query patterns

### API Level
- ✅ Serverless functions (auto-scaling)
- ✅ Edge caching (Vercel)
- ✅ Minimal data transfer

### Frontend Level
- ✅ Static page generation
- ✅ Client-side caching
- ✅ Optimistic updates (optional)

## Scalability

```
Traffic: 10 req/s
     │
     ▼
Vercel: 1 serverless function
     │
     ▼
Supabase: Small instance
     │
     ▼
✓ Handles easily


Traffic: 1000 req/s
     │
     ▼
Vercel: Auto-scales to N functions
     │
     ▼
Supabase: Auto-scales
     │
     ▼
✓ Handles automatically
```

## Technology Stack

```
┌─────────────────────────────────────┐
│          Frontend Layer             │
│  • Next.js 16 (App Router)          │
│  • React 19                         │
│  • TypeScript                       │
│  • Tailwind CSS                     │
│  • shadcn/ui                        │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│          API Layer                  │
│  • Next.js API Routes               │
│  • Zod (Validation)                 │
│  • TypeScript                       │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│        Database Layer               │
│  • Supabase                         │
│  • PostgreSQL 15                    │
│  • Row Level Security               │
└─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│       Infrastructure                │
│  • Vercel (Hosting)                 │
│  • Supabase Cloud                   │
│  • Global CDN                       │
└─────────────────────────────────────┘
```

---

This architecture provides:
- ✅ **Scalability** - Auto-scales with traffic
- ✅ **Reliability** - Managed infrastructure
- ✅ **Performance** - Edge caching + CDN
- ✅ **Security** - Multiple layers of protection
- ✅ **Developer Experience** - Type-safe, hot reload
- ✅ **Cost-Effective** - Generous free tiers
