# 🏆 Lolfinder

![Lolfinder Banner](https://via.placeholder.com/1200x300.png?text=Lolfinder+-+League+of+Legends+Tournament+Platform)

> **Lolfinder** is a modern, full-stack platform designed for discovering, organizing, and participating in League of Legends tournaments. Built with Next.js and Supabase, it provides a seamless experience for players, teams, and tournament administrators.

---

## 🌟 Key Features

### 👤 For Players
- **Profile Management**: Set up your summoner profile with in-game icon verification and integration with 42 School OAuth.
- **Find Teams**: Browse the player directory, form squads, and manage your team roster.
- **Leaderboards**: Compete for the top spot on global and tournament-specific leaderboards.
- **Notifications & Chat**: Stay updated with real-time notifications and dedicated team chat channels.

### 👥 For Teams
- **Team Dashboard**: Manage team avatars (integrated with Azure CDN), roles, and match history.
- **Tournament Registration**: Seamlessly sign up for upcoming tournaments with one-click group registration.
- **Live Match Tracking**: View upcoming matches, report scores, and track your run through the bracket.

### 🛡️ For Administrators
- **Robust Bracket Engines**: Support for Round Robin, Swiss, and Single Elimination formats.
- **Advanced Seeding Control**: Drag-and-drop interface for dynamic seeding, even after bracket generation.
- **Tournament Simulator**: Test match logic, progression, and tie-breakers before going live.
- **Anti-Bot Filtering**: Automated protection against bot entries in public directories and leaderboards.

---

## 🛠️ Tech Stack

Lolfinder is built on a modern, high-performance tech stack:

- **Framework**: [Next.js 15+ (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + GoTrue)
- **Caching & Rate Limiting**: [Upstash Redis](https://upstash.com/)
- **Asset Storage**: [Azure Blob Storage](https://azure.microsoft.com/en-us/products/storage/blobs/)
- **Icons**: Custom Tournament Icons & [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites
- Node.js (v20+ recommended)
- `npm`, `yarn`, or `pnpm`
- A Supabase Project (for DB and Auth)
- Azure Blob Storage Account (optional, for CDN assets)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lolfinder.git
   cd lolfinder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and fill out the necessary variables:
   ```bash
   cp .env.example .env.local
   ```
   *Required variables include Supabase URL/Anon Key, and optionally Upstash/Azure credentials.*

4. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 📁 Project Structure

```text
lolfinder/
├── app/               # Next.js App Router (Pages, Layouts, API Routes)
│   ├── admin/         # Administrator dashboards
│   ├── tournaments/   # Tournament discovery, match views, standings
│   ├── teams/         # Team profiles and management
│   └── ...
├── components/        # Reusable React components (Radix UI, layout pieces)
├── lib/               # Utility functions, formatters, and helpers
├── supabase/          # Supabase configuration, edge functions, schemas
├── scripts/           # Helper scripts (e.g., db checks, Swiss helpers)
├── docs/              # Additional project documentation
└── public/            # Static assets and images
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the [issues page](https://github.com/yourusername/lolfinder/issues) if you want to contribute.

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the terms of the **LICENSE** file included in the repository root.
