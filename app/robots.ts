import { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://teamfinder.gg'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/settings/',
          '/notifications/',
          '/manage-team/',
          '/create-team/',
          '/create-player/',
          '/setup-profile/',
          '/team-chat/',
          '/chat-demo/',
          '/ui-test/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
