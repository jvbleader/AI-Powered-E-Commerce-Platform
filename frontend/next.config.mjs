/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      // Enable polling for Docker on Windows (inotify events don't propagate through WSL2/HyperV)
      config.watchOptions = {
        poll: 1000,       // Check for changes every 1 second
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
