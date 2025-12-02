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
    default: 'lolfinder - League of Legends Tournament Platform',
    template: '%s | lolfinder',
  },
  description: 'Find your perfect team or teammates for competitive League of Legends tournaments. Create teams, join tournaments, and climb the ranks together.',
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
    siteName: 'TeamFinder',
    title: 'Lolfinder - League of Legends Tournament Platform',
    description: 'Find your perfect team or teammates for competitive League of Legends tournaments. Create teams, join tournaments, and climb the ranks together.',
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
    title: 'lolfinder - League of Legends Tournament Platform',
    description: 'Find your perfect team or teammates for competitive League of Legends tournaments.',
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
      name: 'TeamFinder',
      description: 'Find your perfect team or teammates for competitive League of Legends tournaments.',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
      potentialAction: [
        {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      ],
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'TeamFinder',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
        width: 512,
        height: 512,
      },
      sameAs: [
        // Add your social media URLs here
        // 'https://twitter.com/teamfinder',
        // 'https://discord.gg/teamfinder',
      ],
    },
    {
      '@type': 'WebApplication',
      '@id': `${siteUrl}/#webapp`,
      name: 'TeamFinder',
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
