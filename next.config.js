/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'images.unsplash.com',
      'lh3.googleusercontent.com',
      // замени на хост своего проекта Supabase:
      'YOUR-PROJECT-ID.supabase.co'
    ]
  }
}

module.exports = nextConfig
