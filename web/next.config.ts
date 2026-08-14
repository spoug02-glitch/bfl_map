import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/crawl-runs": ["./collector-runs.json"],
  },
};

export default nextConfig;
