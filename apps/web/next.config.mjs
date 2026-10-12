/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone-выход нужен для Docker-образа (фаза 16.1): минимальный runner без node_modules
  output: 'standalone',
  images: {
    // Хосты медиа из S3/CDN добавляются через env MEDIA_IMAGE_HOSTS (через запятую)
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'localhost' },
      ...(process.env.MEDIA_IMAGE_HOSTS ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: 'https', hostname })),
    ],
  },
};
export default nextConfig;
