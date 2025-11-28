# LoL Finder

[![Coverage Status](https://img.shields.io/badge/coverage-90%25-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Version](https://img.shields.io/badge/version-1.0.0-purple)](https://github.com/your-username/lolfinder)

**LoL Finder** is a modern web application for League of Legends players to find teams, join tournaments, and connect with other players in the EUW region. Built with Next.js, TypeScript, and Supabase.

## Features

- [x] **Player Profiles** - Create detailed profiles with Riot API integration
- [x] **Team Management** - Create, join, and manage teams with role-based permissions
- [x] **Tournament System** - Browse, register, and participate in tournaments
- [x] **Real-time Rankings** - Automatic rank fetching from Riot API
- [x] **Responsive Design** - Mobile-first UI with dark theme
- [x] **Authentication** - Secure Supabase Auth integration

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library
- **Lucide React** - Beautiful icons

### Backend
- **Supabase** - Authentication, database, and real-time
- **Riot Games API** - Player data and rankings
- **PostgreSQL** - Database with migrations
- **Edge Functions** - Serverless API endpoints

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn
- Supabase account
- Riot Games API key

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/lolfinder.git
cd lolfinder
pnpm install
```

### Environment Setup

1. Copy the environment file:
```bash
cp .env.example .env.local
```

2. Fill in your environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RIOT_API_KEY=your_riot_api_key
```

### Database Setup

1. Start Supabase locally:
```bash
pnpm supabase start
```

2. Run migrations:
```bash
pnpm supabase db push
```

### Running the App

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Integration

### Riot Games API

The app integrates with the Riot Games API to:
- Validate summoner names and tags
- Fetch player ranks and statistics
- Update player profiles automatically
- Generate op.gg links

### Rate Limits

To optimize API usage:
- Player data is cached and updated periodically
- Bulk updates use optimized endpoints
- Failed requests are logged for monitoring

## Database Schema

### Core Tables

- **players** - Player profiles and statistics
- **teams** - Team information and management
- **tournaments** - Tournament details and settings
- **tournament_registrations** - Team-tournament relationships

### Views

- **team_with_players** - Pre-joined team data
- **tournament_with_teams** - Tournament with registered teams

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard

### Docker

Build and run with Docker:

```bash
docker build -t lolfinder .
docker run -p 3000:3000 lolfinder
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns
- Use Tailwind for styling
- Write meaningful commit messages

## Support

- 📧 Email: support@lolfinder.com
- 💬 Discord: [Join our community](https://discord.gg/lolfinder)
- 🐛 Issues: [Report on GitHub](https://github.com/your-username/lolfinder/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Riot Games for the amazing API
- Supabase for the excellent backend platform
- The open-source community for inspiration and tools

---

**Built with ❤️ for the League of Legends community**
