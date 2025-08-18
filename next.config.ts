import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right'
  },

  experimental: {
    cssChunking: 'strict',
    reactCompiler: true,
    viewTransition: true
  },

  poweredByHeader: false,
  reactMaxHeadersLength: 1000,

  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true
    },
    incomingRequests: {
      ignore: [/\favicon\.ico/]
    }
  },

  typescript: {
    ignoreBuildErrors: true
  }
};

export default nextConfig;
