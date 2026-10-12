/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone-выход для Docker-образа (фаза 16.1)
  output: 'standalone',
  images: { remotePatterns: [{ protocol: 'http', hostname: 'localhost' }] },
};
export default nextConfig;
