import type { NextConfig } from 'next';


const nextConfig: NextConfig = {
  cacheComponents: true,

  // AIDEV-NOTE: Opt-out Node-specific deps from Server Components bundling.
  // This is recommended for packages like Pino that use worker threads / native Node resolution.
  // Ref: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  devIndicators: {
    position: 'bottom-right'
  },

  experimental: {
    cssChunking: 'strict',
    viewTransition: true
  },

  poweredByHeader: false,
  reactMaxHeadersLength: 1000,

  typedRoutes: true,
  images: {
    // qualities: [75, 100], // Explicitly allow quality={100},
    // localPatterns: [
    //   {
    //     pathname: '/photo.jpg', // allow exact path
    //     // omitting "search" will allow all query parameters
    //   },
    //   {
    //     pathname: '/photo.jpg', // allow exact path
    //     search: '?v=1', // allow exact query parameters
    //   },
    //   {
    //     pathname: '/assets/**', // allow wildcard path
    //     search: '', // empty search will block all query parameters
    //   }
    // ]
  },

  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true
    },
    incomingRequests: {
      ignore: [/\favicon\.ico/]
    }
  },

  reactCompiler: true,

  typescript: {
    ignoreBuildErrors: true
  }
};


export default nextConfig;
