/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'images.unsplash.com',
      'lh3.googleusercontent.com',
      'maps.googleapis.com',            // ← добавили
      'hvraekrmhgzchzrgvken.supabase.co'     // замени на свой
    ]
  }
}

module.exports = nextConfig
