import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import Navigation from '@/components/navigation'
import NotificationPermission from '@/components/NotificationPermission'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teamfinder.gg'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'League of Legends Team Finder | LoL Team Finder',
    template: '%s | lolfinder',
  },
  description: 'Find LoL team fast. Join LoL tournaments, find teammates for ranked and Clash. The #1 League of Legends team finder platform.',
  keywords: [
    'League of Legends',
    'LoL',
    'team finder',
    'esports',
    'tournament',
    'competitive gaming',
    'ranked teams',
    'find teammates',
    'gaming community',
    'LoL tournament platform',
    'teamfinder league of legends',
    'find lol team',
    'search lol team',
    'league of legends team finder',
    'league of legends team search',
    'lol tournament team',
    'lol looking for team',
    'lol lft (looking for team)',
    'lol lfg (looking for group)',
    'league team recruitment',
    'find players league of legends',
    'lol competitive team',
    'league esports team finder',
    'lol ranked team finder',
    'find a team for league of legends tournament',
    'how to join a lol team',
    'best website to find lol team',
    'looking for players for league of legends',
    'how to find teammates for lol',
    'lol tournament registration team',
    'create a team for lol tournament',
    'where to find competitive lol players',
    'lol clash team finder',
    'find soloq partners lol',
    'duo queue partner lol',
    'lol 5v5 team recruitment platform',
    'looking for adc / support / mid / top / jungle team',
    'league of legends tournament team finder',
    'lol tournament registration',
    'lol esports amateur tournaments',
    'join lol tournament team',
    'find tournament teammates lol',
    'lol 5v5 tournament team',
    'lol clash tournament team',
    'lol scrims finder',
    'scrim team league of legends',
    'lol competitive practice',
    'league competitive gaming',
    'esports recruitment',
    'online gaming teams',
    'multiplayer team finder',
    'MOBA team finder',
    'competitive matchmaking',
    'find teammates online',
    'competitive gaming communities',
    'amateur esports teams',
    'trouver équipe league of legends',
    'chercher team lol',
    'recrutement joueurs lol',
    'équipe pour tournoi lol',
    'trouver joueurs league of legends',
  ],
  authors: [{ name: 'TeamFinder' }],
  creator: 'TeamFinder',
  publisher: 'TeamFinder',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'lolfinder',
    title: 'League of Legends Team Finder | Build Your LoL Team',
    description: 'Use our League of Legends team finder to find LoL team, recruit competitive players and join tournaments for Clash, Flex and ranked.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TeamFinder - Find your perfect LoL team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'League of Legends Team Finder | LoL Team Finder',
    description: 'Find LoL team fast. Join tournaments, find teammates for ranked and Clash on our LoL team finder.',
    images: ['/og-image.png'],
    creator: '@teamfinder',
  },
  verification: {
    // Add your verification codes here when you have them
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'gaming',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#5bbad5',
      },
    ],
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'lolfinder',
      description: 'League of Legends team finder helping you find LoL teams, tournament teams and competitive teammates for ranked, Clash and Flex.',
      inLanguage: 'en',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
      keywords: [
        'league of legends team finder',
        'lol team finder',
        'find lol team',
        'lol tournament team',
        'find teammates for ranked, clash, flex',
        'competitive lol players',
        'join lol tournaments',
        'lol clash team finder',
        'league of legends tournament team finder',
        'lol esports amateur tournaments',
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'lolfinder',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
        width: 512,
        height: 512,
      },
      sameAs: [
        // Add your social media URLs here
        // 'https://twitter.com/lolfinder',
        // 'https://discord.gg/lolfinder',
      ],
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: 'lolfinder',
      description: 'Find LoL team, join tournaments, and recruit competitive players for ranked, Clash and Flex.',
      url: siteUrl,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
      <link rel="icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning={true}>
        <Suspense fallback={<div className="h-16 w-full bg-background/80 border-b border-border fixed top-0 z-50" />}>
          <Navigation />
        </Suspense>
        {children}
        <NotificationPermission />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                    })
                    .catch(function(registrationError) {
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
 