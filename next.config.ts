import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: [
    '10.179.156.189',   // local network IP (mobile same WiFi)
    '*.local',
    '192.168.*',
  ],
};

export default nextConfig;
