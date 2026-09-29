/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the slim runtime stage in the Dockerfile.
  output: 'standalone',
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // @google-cloud/storage must stay a real Node dependency, never bundled/traced away.
  serverExternalPackages: ['@google-cloud/storage'],
  poweredByHeader: false,
};

module.exports = nextConfig;
