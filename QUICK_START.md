# Quick Start Checklist ✅

Follow these steps to get your Supabase backend running:

## 1. Create Supabase Project (5 minutes)

- [ ] Go to [supabase.com](https://supabase.com)
- [ ] Sign up or log in
- [ ] Click "New Project"
- [ ] Fill in project details
- [ ] Wait for project creation

## 2. Set Up Database (2 minutes)

- [ ] Open Supabase Dashboard
- [ ] Go to **SQL Editor**
- [ ] Click "New Query"
- [ ] Copy contents of `/supabase/schema.sql`
- [ ] Paste and click "Run"
- [ ] Verify tables created in **Table Editor**

## 3. Get API Keys (1 minute)

- [ ] Go to **Settings** → **API**
- [ ] Copy **Project URL**
- [ ] Copy **anon/public key**

## 4. Configure Environment (1 minute)

- [ ] Create `.env.local` in project root
- [ ] Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Run the Project (1 minute)

```bash
pnpm install  # Already done if you installed dependencies
pnpm dev
```

- [ ] Open http://localhost:3000
- [ ] Verify app loads

## 6. Test API (2 minutes)

Open a new terminal and test:

```bash
# Create a test player
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
```

- [ ] Player created successfully
- [ ] Can retrieve players

## 7. Verify in Supabase (1 minute)

- [ ] Go to Supabase Dashboard
- [ ] Click **Table Editor**
- [ ] Click **players** table
- [ ] See your test player

## 8. Test Frontend (2 minutes)

- [ ] Go to http://localhost:3000/create-player
- [ ] Fill out the form
- [ ] Submit
- [ ] Go to http://localhost:3000/players
- [ ] See your created player

---

## ✅ You're Done!

Your backend is now fully functional with:
- ✅ Supabase PostgreSQL database
- ✅ Next.js API routes
- ✅ Full CRUD operations
- ✅ Search functionality
- ✅ Type-safe TypeScript

## 📚 Next Steps

1. **Read the docs:**
   - [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Detailed setup guide
   - [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
   - [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - If migrating from Express

2. **Customize:**
   - Update RLS policies for security
   - Add authentication
   - Customize the frontend

3. **Deploy:**
   - Push to GitHub
   - Deploy to Vercel
   - Add environment variables

## 🆘 Troubleshooting

**"Missing Supabase environment variables"**
- Check `.env.local` exists and has correct values
- Restart dev server after adding env vars

**"Cannot connect to database"**
- Verify Supabase project is active
- Check API keys are correct
- Ensure schema.sql was run successfully

**"Module not found '@/lib/supabase'"**
- Check `tsconfig.json` has path aliases configured
- Restart TypeScript server in your IDE

**CORS errors**
- Next.js API routes handle CORS automatically
- If using external domain, check Supabase settings

## 🎉 Success!

If all checkboxes are checked, you're ready to build your League of Legends tournament platform!

Need help? Check the documentation files or visit:
- [Supabase Discord](https://discord.supabase.com)
- [Next.js Discord](https://discord.gg/nextjs)
