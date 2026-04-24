/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy only auth-related routes through Next.js API routes (for httpOnly cookies).
  // All other API calls go direct from browser → FastAPI with CORS.
  async rewrites() {
    return [];
  },
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1",
  },
};

module.exports = nextConfig;
