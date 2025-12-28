// src/app/layout.tsx
import type { Metadata } from 'next'
import { Manrope, Roboto_Mono } from 'next/font/google'
import './globals.css'
import LayoutWrapper from '@/components/LayoutWrapper'
import { DashboardSessionProvider } from '@/context/dashboard-session-context'
import { ThemeProvider } from '@/components/theme-provider'
import { InvoiceProvider } from '@/context/InvoiceContext'
import { FinancialDataProvider } from '@/context/FinancialDataContext'
import { Toaster } from '@/components/ui/toaster'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Clerio Dashboard',
  description: 'Panel de control de Clerio',
  icons: {
    icon: '/brand/favicon_azul.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${manrope.variable} ${robotoMono.variable} antialiased`}>
        <DashboardSessionProvider>
          <FinancialDataProvider>
            <InvoiceProvider>
              <ThemeProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
                <Toaster />
              </ThemeProvider>
            </InvoiceProvider>
          </FinancialDataProvider>
        </DashboardSessionProvider>
      </body>
    </html>
  )
}