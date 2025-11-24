# Supabase Backend Setup Guide

This project now uses **Supabase** as the backend with **Next.js API Routes** for a serverless architecture.

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - **Name**: Your project name
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your users
4. Wait for the project to be created (~2 minutes)

### 2. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `/supabase/schema.sql` and paste it
4. Click "Run" to execute the SQL
5. This will create all tables, indexes, and policies

### 3. Get Your API Keys

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 4. Configure Environment Variables

1. Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

2. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install Dependencies & Run

```bash
pnpm install
pnpm dev
```

Your API will be available at: `http://localhost:3000/api`

---

## 📊 Database Schema

### Tables Created

1. **players** - Player profiles with roles, tiers, and regions
2. **teams** - Team information with captains and open positions
3. **tournaments** - Tournament details with dates and prize pools
4. **tournament_registrations** - Team registrations for tournaments

### Features

- ✅ UUID primary keys
- ✅ Automatic timestamps (created_at, updated_at)
- ✅ Foreign key relationships
- ✅ Indexes for performance
- ✅ Row Level Security (RLS) enabled
- ✅ ENUM types for roles, tiers, regions, etc.

---

## 🛣️ API Endpoints

All endpoints are available at `/api/*`:

### Players

- `GET /api/players` - List all players (with filters)
  - Query params: `role`, `tier`, `region`, `lookingForTeam`
- `POST /api/players` - Create new player
- `GET /api/players/[id]` - Get player details
- `PUT /api/players/[id]` - Update player
- `DELETE /api/players/[id]` - Delete player

### Teams

- `GET /api/teams` - List all teams (with filters)
  - Query params: `tier`, `region`, `recruiting`
- `POST /api/teams` - Create new team
- `GET /api/teams/[id]` - Get team details with members
- `PUT /api/teams/[id]` - Update team
- `DELETE /api/teams/[id]` - Delete team
- `POST /api/teams/[id]/members` - Add player to team
- `DELETE /api/teams/[id]/members/[playerId]` - Remove player from team

### Tournaments

- `GET /api/tournaments` - List all tournaments
  - Query params: `upcoming=true` for upcoming only
- `POST /api/tournaments` - Create tournament
- `GET /api/tournaments/[id]` - Get tournament details
- `PUT /api/tournaments/[id]` - Update tournament
- `DELETE /api/tournaments/[id]` - Delete tournament
- `POST /api/tournaments/[id]/register` - Register team
- `GET /api/tournaments/[id]/registrations` - Get registrations

### Registrations

- `GET /api/registrations/[id]` - Get registration details
- `PUT /api/registrations/[id]` - Update registration status

### Search

- `GET /api/search` - Advanced search
  - Required: `type=player` or `type=team`
  - Optional: `query`, `role`, `tier`, `region`, `lookingForTeam`, `recruiting`

---

## 🧪 Testing the API

### Using cURL

```bash
# Create a player
curl -X POST http://localhost:3000/api/players \
  -H "Content-Type: application/json" \
  -d '{
    "summoner_name": "TestPlayer",
    "discord": "test#1234",
    "main_role": "Mid",
    "tier": "Gold",
    "region": "NA",
    "looking_for_team": true
  }'

# Get all players
curl http://localhost:3000/api/players

# Search for players
curl "http://localhost:3000/api/search?type=player&role=Mid&tier=Gold"
```

### Using the Frontend

Your existing Next.js frontend pages should work automatically since the API routes are in the same project!

---

## 🔒 Security Notes

### Current Setup (Development)

- RLS is enabled but policies allow all operations
- No authentication required
- Suitable for development and testing

### For Production

You should implement:

1. **Authentication** - Use Supabase Auth
2. **Authorization** - Update RLS policies
3. **Rate Limiting** - Add API rate limits
4. **Input Validation** - Already implemented with Zod

### Example: Adding Authentication

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
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

Then update RLS policies to check `auth.uid()`.

---

## 📦 Project Structure

```
/home/yusuf/api/
├── app/
│   ├── api/                    # API Routes
│   │   ├── players/
│   │   │   ├── route.ts        # GET, POST /api/players
│   │   │   └── [id]/
│   │   │       └── route.ts    # GET, PUT, DELETE /api/players/[id]
│   │   ├── teams/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── members/
│   │   ├── tournaments/
│   │   ├── registrations/
│   │   └── search/
│   └── (your frontend pages)
├── lib/
│   ├── supabase.ts            # Supabase client & types
│   └── utils.ts
├── supabase/
│   └── schema.sql             # Database schema
├── .env.local                 # Your environment variables
└── .env.example               # Template
```

---

## 🔄 Migrating from Express Backend

If you had an Express backend before:

1. ✅ All endpoints are now Next.js API routes
2. ✅ Database is now Supabase (PostgreSQL)
3. ✅ No separate backend server needed
4. ✅ Deploy everything together on Vercel

### Benefits

- **Serverless** - No server management
- **Auto-scaling** - Handles traffic automatically
- **Global CDN** - Fast worldwide
- **Free tier** - Generous free limits
- **Type-safe** - Full TypeScript support

---

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

Your API will be available at: `https://your-app.vercel.app/api`

---

## 🛠️ Development Tips

### Viewing Database

Use Supabase Dashboard → **Table Editor** to view/edit data directly.

### Database Migrations

If you need to modify the schema:

1. Make changes in Supabase Dashboard or SQL Editor
2. Update `/supabase/schema.sql` to keep it in sync
3. Consider using Supabase CLI for migrations in production

### Type Safety

All database types are defined in `/lib/supabase.ts`. Update them if you change the schema.

### Error Handling

All routes include proper error handling with appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Server Error

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

---

## ❓ Troubleshooting

### "Missing Supabase environment variables"

Make sure `.env.local` exists and contains valid credentials.

### CORS Errors

Next.js API routes handle CORS automatically. If you need custom CORS:

```typescript
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
```

### Database Connection Issues

Check that:
1. Your Supabase project is active
2. Environment variables are correct
3. You ran the schema.sql file

---

## 🎯 Next Steps (Optional Enhancements)

1. **Add authentication** - See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for Supabase Auth setup
2. Add rate limiting
3. Add request logging
4. Add unit and integration tests
5. Add API documentation (Swagger/OpenAPI)
6. Deploy to production (Vercel)
7. Add real-time subscriptions (Supabase supports this!)
8. Add file upload for player avatars/team logos (Supabase Storage)
9. Enable Discord OAuth (perfect for gaming platform!)
10. Add email notifications

**Your backend is now fully serverless and ready to scale!** 🎉
