# Migration Guide: Express + Prisma → Next.js + Supabase

This guide helps you migrate from the old Express backend to the new Next.js + Supabase setup.

## What Changed?

### Before (Express + Prisma + SQLite)
```
/backend/
  ├── src/
  │   ├── index.ts          # Express server
  │   ├── controllers/      # Business logic
  │   └── routes/           # Route definitions
  ├── prisma/
  │   └── schema.prisma     # Database schema
  └── dev.db                # SQLite database

Separate server running on port 3001
```

### After (Next.js + Supabase)
```
/app/
  └── api/                  # API Routes (serverless)
      ├── players/
      ├── teams/
      └── tournaments/
/lib/
  └── supabase.ts          # Supabase client
/supabase/
  └── schema.sql           # PostgreSQL schema

No separate server - runs with Next.js
```

## Benefits of Migration

✅ **Serverless** - No server to manage or maintain  
✅ **Auto-scaling** - Handles any traffic automatically  
✅ **PostgreSQL** - More powerful than SQLite  
✅ **Unified Deployment** - Frontend + Backend together  
✅ **Free Hosting** - Vercel free tier is generous  
✅ **Better DX** - Hot reload for API routes  
✅ **Real-time** - Supabase supports real-time subscriptions  

## Step-by-Step Migration

### 1. Set Up Supabase

Follow the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) guide to:
- Create a Supabase project
- Run the schema.sql
- Get your API keys

### 2. Update Environment Variables

**Old (.env in /backend):**
```env
DATABASE_URL="file:./dev.db"
PORT=3001
```

**New (.env.local in root):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Update Frontend API Calls

**Old:**
```typescript
// Calling Express backend
const response = await fetch('http://localhost:3001/api/players');
```

**New:**
```typescript
// Calling Next.js API routes
const response = await fetch('/api/players');
// or for external calls:
const response = await fetch('https://your-app.vercel.app/api/players');
```

### 4. Data Migration (Optional)

If you have existing data in SQLite, you can migrate it:

#### Export from SQLite
```bash
cd backend
npx prisma db pull
npx prisma db seed  # if you have seed data
```

#### Import to Supabase
Use the Supabase dashboard to import data:
1. Go to **Table Editor**
2. Click on a table
3. Click **Insert** → **Import from CSV**

Or use SQL:
```sql
INSERT INTO players (summoner_name, discord, main_role, tier, region, looking_for_team)
VALUES ('Player1', 'discord#1234', 'Mid', 'Gold', 'NA', true);
```

### 5. Remove Old Backend

Once everything is working:

```bash
# Optional: backup first
mv backend backend_old

# Or delete
rm -rf backend
```

## API Endpoint Mapping

All endpoints remain the same, just the base URL changes:

| Old Express | New Next.js |
|------------|-------------|
| `http://localhost:3001/api/players` | `/api/players` |
| `http://localhost:3001/api/teams` | `/api/teams` |
| `http://localhost:3001/api/tournaments` | `/api/tournaments` |
| `http://localhost:3001/api/search` | `/api/search` |

## Code Comparison

### Creating a Player

**Old (Express + Prisma):**
```typescript
// backend/src/controllers/playerController.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createPlayer = async (req: Request, res: Response) => {
  try {
    const player = await prisma.player.create({
      data: req.body
    });
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
```

**New (Next.js + Supabase):**
```typescript
// app/api/players/route.ts
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await supabase
    .from('players')
    .insert([body])
    .select()
    .single();
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 201 });
}
```

### Querying with Filters

**Old (Prisma):**
```typescript
const players = await prisma.player.findMany({
  where: {
    tier: 'Gold',
    region: 'NA',
    lookingForTeam: true
  }
});
```

**New (Supabase):**
```typescript
const { data } = await supabase
  .from('players')
  .select('*')
  .eq('tier', 'Gold')
  .eq('region', 'NA')
  .eq('looking_for_team', true);
```

## Database Schema Changes

### Field Name Conventions

Supabase uses `snake_case` for database columns (PostgreSQL convention):

| Prisma (camelCase) | Supabase (snake_case) |
|-------------------|----------------------|
| `summonerName` | `summoner_name` |
| `lookingForTeam` | `looking_for_team` |
| `opggLink` | `opgg_link` |
| `captainId` | `captain_id` |
| `openPositions` | `open_positions` |
| `recruitingStatus` | `recruiting_status` |
| `maxTeams` | `max_teams` |
| `prizePool` | `prize_pool` |
| `startDate` | `start_date` |
| `endDate` | `end_date` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

### Type Definitions

Update your TypeScript types to match:

```typescript
// Old
interface Player {
  summonerName: string;
  lookingForTeam: boolean;
}

// New
interface Player {
  summoner_name: string;
  looking_for_team: boolean;
}
```

Or use the types from `/lib/supabase.ts`.

## Testing After Migration

### 1. Test API Endpoints

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

# Search
curl "http://localhost:3000/api/search?type=player&tier=Gold"
```

### 2. Test Frontend Integration

Make sure your frontend pages work:
- `/create-player` - Create player form
- `/create-team` - Create team form
- `/players` - List players
- `/teams` - List teams
- `/search` - Search functionality

### 3. Check Database

View data in Supabase Dashboard → **Table Editor**

## Troubleshooting

### "Cannot find module '@/lib/supabase'"

Make sure `tsconfig.json` has the path alias:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### CORS Issues

Next.js API routes handle CORS automatically. If you need custom CORS, add:
```typescript
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    },
  });
}
```

### Database Connection Errors

Check:
1. Environment variables are set correctly
2. Supabase project is active
3. Schema was created successfully

### Type Errors

Update imports:
```typescript
// Old
import { Player } from '@prisma/client';

// New
import { Player } from '@/lib/supabase';
```

## Deployment

### Old Deployment (Express)
- Deploy backend to Railway/Render/Heroku
- Deploy frontend to Vercel
- Configure CORS
- Manage two deployments

### New Deployment (Next.js + Supabase)
- Push to GitHub
- Connect to Vercel
- Add environment variables
- Deploy! ✨

Everything deploys together automatically.

## Rollback Plan

If you need to rollback:

1. Keep the old `backend` folder
2. Restore `.env` in backend
3. Run `cd backend && npm run dev`
4. Update frontend to use `http://localhost:3001/api`

## Next Steps

After migration:

1. ✅ Test all endpoints
2. ✅ Update frontend API calls
3. ✅ Test frontend functionality
4. 🔒 Add authentication (optional)
5. 🚀 Deploy to production
6. 🗑️ Remove old backend folder

## Need Help?

- Check [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for setup details
- Check [API_REFERENCE.md](./API_REFERENCE.md) for endpoint docs
- Visit [Supabase Docs](https://supabase.com/docs)
- Visit [Next.js Docs](https://nextjs.org/docs)

---

**Congratulations on migrating to a modern serverless architecture!** 🎉
