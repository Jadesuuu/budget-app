import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // Bank history/statement uploads (CSV or PDF) go through a Server Action.
    serverActions: { bodySizeLimit: "6mb" },
  },
  partialPrefetching: true,
  // Demo build (NEXT_PUBLIC_DEMO_MODE=true): PGlite loads its WebAssembly from node_modules and runs the migrations.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/*.sql"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may frame Budget (clickjacking). frame-ancestors is the modern form of X-Frame-Options.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
