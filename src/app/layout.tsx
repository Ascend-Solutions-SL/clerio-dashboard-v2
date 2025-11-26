// src/app/layout.tsx
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import LayoutWrapper from '@/components/LayoutWrapper'
import { DashboardSessionProvider } from '@/context/dashboard-session-context'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationProvider } from '@/context/NotificationContext'
import { InvoiceProvider } from '@/context/InvoiceContext'
import { FinancialDataProvider } from '@/context/FinancialDataContext'
import { Toaster } from '@/components/ui/toaster'

const outfit = Outfit({ 
  subsets: ['latin'], 
  weight: ['200', '300', '400', '500', '600'] 
})

export const metadata: Metadata = {
  title: 'Clerio Dashboard',
  description: 'Panel de control de Clerio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={outfit.className}>
        <DashboardSessionProvider>
          <NotificationProvider>
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
          </NotificationProvider>
        </DashboardSessionProvider>
      </body>
    </html>
  )
}