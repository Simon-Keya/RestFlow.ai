import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Lets the browser call same-origin `/api/proxy/*` in production while the
    // NestJS API lives on a different host; avoids leaking the API origin to the client bundle.
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
