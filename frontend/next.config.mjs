/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.1.177', '192.168.1.*', 'localhost:3000', '127.0.0.1:3000', '192.168.0.*', '192.168.0.103*'],
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
