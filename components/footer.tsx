import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-slate-900 mt-auto pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-6 group">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] group-hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] transition-all">
                <span className="text-black font-black text-xl">L</span>
              </div>
              <span className="text-2xl font-black tracking-tighter text-white group-hover:text-yellow-500 transition-colors uppercase">
                LoL<span className="text-yellow-500 group-hover:text-white transition-colors">Finder</span>
              </span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed">
              The premier platform for League of Legends competitive play. Find teams, scout players, and dominate tournaments.
            </p>
          </div>

          {/* Platform Links */}
          <div>
            <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-6">Platform</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <Link href="/about" className="hover:text-yellow-500 transition-colors duration-200">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/tournaments" className="hover:text-yellow-500 transition-colors duration-200">
                  Tournaments
                </Link>
              </li>
              <li>
                <Link href="/players" className="hover:text-cyan-400 transition-colors duration-200">
                  Find Players
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-cyan-400 transition-colors duration-200">
                  Browse Teams
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-6">Resources</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <Link href="/help" className="hover:text-yellow-500 transition-colors duration-200">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-yellow-500 transition-colors duration-200">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-slate-200 transition-colors duration-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-200 transition-colors duration-200">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-6">Connect</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <a
                  href="https://github.com/yusufsemlali"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Shams
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/medibrs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  MonkeyingAround
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Premium Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent mb-8" />

        {/* Copyright & Legal */}
        <div className="text-center text-xs text-slate-500 space-y-4">
          <p className="uppercase tracking-widest">&copy; 2025 LoLFinder. All rights reserved.</p>
          <p className="leading-relaxed max-w-4xl mx-auto italic">
            <strong>LoLFinder</strong> isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </div>
      </div>
    </footer>
  )
}
