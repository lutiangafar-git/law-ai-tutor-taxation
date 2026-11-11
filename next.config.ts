import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Load markdown topic files from disk at request time on the server.
  serverExternalPackages: ["gray-matter"],
  // Make sure every reviewed topic file is packed with the server code on Vercel.
  outputFileTracingIncludes: {
    "/api/**": ["./sources/**/*.md"],
  },
};

export default nextConfig;
