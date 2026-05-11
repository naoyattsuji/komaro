import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "pg-native"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "komaro.vercel.app" }],
        destination: "https://komaro.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
