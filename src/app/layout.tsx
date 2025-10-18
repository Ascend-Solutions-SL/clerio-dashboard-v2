import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import LayoutWrapper from '@/components/LayoutWrapper';
import { DashboardSessionProvider } from '@/context/dashboard-session-context';

const outfit = Outfit({ subsets: ['latin'], weight: ['200', '300', '400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Clerio Dashboard',
  description: 'Dashboard for Clerio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={outfit.className}>
        <DashboardSessionProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </DashboardSessionProvider>
      </body>
    </html>
  );
}
