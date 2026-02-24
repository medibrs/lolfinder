/** @type {import('next').NextConfig} */
// On Vercel, image optimization works natively. Locally (especially WSL), DNS resolves
// ddragon.leagueoflegends.com to NAT64 private IPs which Next.js blocks. Disable locally.
const isLocal = !process.env.VERCEL

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: isLocal,
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
        pathname: '/cdn/**',
      },
      {
        protocol: 'https',
        hostname: 'lolfinderassets.blob.core.windows.net',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
