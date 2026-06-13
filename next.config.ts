import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 0 (2026-06-13): redirect /garages -> /businesses (กัน 404, รวม path ลูก)
  async redirects() {
    return [
      {
        source: "/garages",
        destination: "/businesses",
        permanent: true, // 308 — บอก Google ว่าย้ายถาวร
      },
      {
        source: "/garages/:slug*",
        destination: "/businesses/:slug*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
