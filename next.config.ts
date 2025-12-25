import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
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
      {
        source: '/cleriochat',
        destination: '/dashboard/cleriochat',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
