/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_SERVER: process.env.DB_SERVER,
    DB_DATABASE: process.env.DB_DATABASE,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    API_RESEND: process.env.API_RESEND,
  },
}

module.exports = nextConfig
