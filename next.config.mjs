/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    'mjml',
    'mjml-core',
    'mjml-preset-core',
    'html-minifier',
    'uglify-js'
  ],
}

export default nextConfig
