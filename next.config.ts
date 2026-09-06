import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PeerJS is dynamically imported client-side only — no special config needed
  turbopack: {},
};

export default nextConfig;
