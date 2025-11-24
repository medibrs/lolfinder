# League of Legends Tournament Platform - Supabase Backend

A modern, serverless backend for a League of Legends tournament platform using **Next.js API Routes** and **Supabase**.

## 🚀 Features

- ✅ **Serverless Architecture** - No server management needed
- ✅ **PostgreSQL Database** - Powered by Supabase
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **RESTful API** - All CRUD operations
- ✅ **Advanced Search** - Filter by role, tier, region, etc.
- ✅ **Real-time Ready** - Supabase supports real-time subscriptions
- ✅ **Auto-scaling** - Handles any traffic automatically
- ✅ **Free Tier** - Generous free limits on Supabase and Vercel

## 📦 What's Included

### Database Models
- **Players** - Player profiles with roles, tiers, and regions
- **Teams** - Team management with captains and members
- **Tournaments** - Tournament creation and management
- **Registrations** - Team tournament registrations

### API Endpoints
- **Players** - CRUD + filtering + search
- **Teams** - CRUD + member management
- **Tournaments** - CRUD + registration system
- **Search** - Advanced search for players and teams

### Documentation
- 📘 [QUICK_START.md](./QUICK_START.md) - Get started in 15 minutes
- 📗 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Detailed setup guide
- 📙 [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- 📕 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migrate from Express backend

## ⚡ Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the SQL from `/supabase/schema.sql` in SQL Editor
4. Get your API keys from Settings → API

### 3. Configure Environment
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server
```bash
pnpm dev
```

Visit http://localhost:3000

### 5. Test API
```bash
curl http://localhost:3000/api/players
```

**That's it!** 🎉

For detailed instructions, see [QUICK_START.md](./QUICK_START.md)

## 📁 Project Structure

```
/home/yusuf/api/
├── app/
│   ├── api/                      # API Routes (serverless functions)
│   │   ├── players/
│   │   │   ├── route.ts          # GET, POST /api/players
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET, PUT, DELETE /api/players/[id]
│   │   ├── teams/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── members/      # Team member management
│   │   ├── tournaments/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── register/     # Tournament registration
│   │   │       └── registrations/
│   │   ├── registrations/
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   └── search/
│   │       └── route.ts          # Advanced search
│   └── (your frontend pages)
├── lib/
│   ├── supabase.ts              # Supabase client & TypeScript types
│   └── utils.ts
├── supabase/
│   └── schema.sql               # PostgreSQL database schema
├── .env.local                   # Your environment variables (create this)
├── .env.example                 # Template for environment variables
├── QUICK_START.md               # Quick start checklist
├── SUPABASE_SETUP.md            # Detailed setup guide
├── API_REFERENCE.md             # API documentation
└── MIGRATION_GUIDE.md           # Migration from Express
```

## 🛣️ API Endpoints

### Players
- `GET /api/players` - List players (with filters)
- `POST /api/players` - Create player
- `GET /api/players/[id]` - Get player
- `PUT /api/players/[id]` - Update player
- `DELETE /api/players/[id]` - Delete player

### Teams
- `GET /api/teams` - List teams (with filters)
- `POST /api/teams` - Create team
- `GET /api/teams/[id]` - Get team with members
- `PUT /api/teams/[id]` - Update team
- `DELETE /api/teams/[id]` - Delete team
- `POST /api/teams/[id]/members` - Add member
- `DELETE /api/teams/[id]/members/[playerId]` - Remove member

### Tournaments
- `GET /api/tournaments` - List tournaments
- `POST /api/tournaments` - Create tournament
- `GET /api/tournaments/[id]` - Get tournament
- `PUT /api/tournaments/[id]` - Update tournament
- `POST /api/tournaments/[id]/register` - Register team
- `GET /api/tournaments/[id]/registrations` - Get registrations

### Search
- `GET /api/search?type=player&role=Mid&tier=Gold` - Advanced search

See [API_REFERENCE.md](./API_REFERENCE.md) for complete documentation.

## 🗄️ Database Schema

### Players Table
```sql
- id (UUID, primary key)
- summoner_name (string)
- discord (string)
- main_role (enum: Top, Jungle, Mid, ADC, Support)
- secondary_role (enum)
- opgg_link (string)
- tier (enum: Iron → Challenger)
- region (enum: NA, EUW, KR, etc.)
- looking_for_team (boolean)
- team_id (UUID, foreign key)
- created_at, updated_at (timestamps)
```

### Teams Table
```sql
- id (UUID, primary key)
- name (string, unique)
- description (text)
- captain_id (UUID, foreign key to players)
- open_positions (array of roles)
- tier (enum)
- region (enum)
- recruiting_status (enum: Open, Closed, Full)
- created_at, updated_at (timestamps)
```

### Tournaments Table
```sql
- id (UUID, primary key)
- name (string)
- description (text)
- start_date, end_date (timestamps)
- prize_pool (string)
- max_teams (integer)
- rules (text)
- created_at, updated_at (timestamps)
```

### Tournament Registrations Table
```sql
- id (UUID, primary key)
- tournament_id (UUID, foreign key)
- team_id (UUID, foreign key)
- status (enum: Pending, Confirmed, Rejected)
- registered_at, updated_at (timestamps)
```

Full schema in `/supabase/schema.sql`

## 🔧 Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Supabase** - PostgreSQL database + Auth + Storage
- **Zod** - Runtime validation
- **Tailwind CSS** - Styling (frontend)
- **shadcn/ui** - UI components (frontend)

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

Your API will be available at: `https://your-app.vercel.app/api`

### Environment Variables

Required for production:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🔒 Security

### Current Setup (Development)
- Row Level Security (RLS) enabled
- Policies allow all operations
- No authentication required

### For Production
You should implement:
1. **Authentication** - Use Supabase Auth
2. **Authorization** - Update RLS policies
3. **Rate Limiting** - Add API rate limits
4. **Input Validation** - Already implemented with Zod ✅

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for security configuration.

## 🧪 Testing

### Test with cURL
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

# Search for Mid players in Gold
curl "http://localhost:3000/api/search?type=player&role=Mid&tier=Gold"
```

### Test with Frontend
- `/create-player` - Create player form
- `/create-team` - Create team form
- `/players` - List players
- `/search` - Search functionality

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 15-minute setup checklist
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Comprehensive setup guide
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete API documentation
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migrate from Express backend

## 🆘 Troubleshooting

### Common Issues

**"Missing Supabase environment variables"**
- Create `.env.local` with your Supabase credentials
- Restart dev server

**"Cannot connect to database"**
- Verify Supabase project is active
- Check API keys are correct
- Ensure schema.sql was executed

**"Module not found '@/lib/supabase'"**
- Check `tsconfig.json` has path aliases
- Restart TypeScript server

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for more troubleshooting.

## 🎯 Roadmap

- [ ] Add authentication (Supabase Auth)
- [ ] Add real-time subscriptions
- [ ] Add file uploads (player avatars, team logos)
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger)
- [ ] Add unit tests
- [ ] Add E2E tests

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📞 Support

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Next.js Discord](https://discord.gg/nextjs)

---

**Built with ❤️ using Next.js and Supabase**
