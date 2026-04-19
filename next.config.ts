import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/ingresos',
        destination: '/dashboard/ingresos',
        permanent: true,
      },
      {
        source: '/gastos',
        destination: '/dashboard/gastos',
        permanent: true,
      },
      {
        source: '/integraciones',
        destination: '/dashboard/integraciones',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
