const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Permanent 301: the /creators directory page was renamed to /drops
      // (June 2026). Keep any existing inbound links + shared URLs working.
      // Using `statusCode: 301` instead of `permanent: true` so the status
      // code is exactly 301 (not Next.js's default 308) — matches the SEO
      // spec the user requested.
      { source: '/creators', destination: '/drops', statusCode: 301 },
    ];
  },
};

module.exports = nextConfig;
