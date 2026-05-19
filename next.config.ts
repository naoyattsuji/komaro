import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pg-native"],
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "komaro.vercel.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "komaro.vercel.app" }],
        destination: "https://komaro.app/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.komaro.app" }],
        destination: "https://komaro.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
