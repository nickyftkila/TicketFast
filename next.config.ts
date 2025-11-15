import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración estándar sin Turbopack
  experimental: {
    // Deshabilitar características experimentales que puedan causar problemas
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.json$/,
      type: 'json',
    });
    return config;
  },
};

export default nextConfig;
