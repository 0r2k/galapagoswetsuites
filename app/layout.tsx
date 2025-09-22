import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Galápagos - Wetsuit & Snorkeling',
  description: 'By Chokotrip',
  icons: "/favicon.webp",
  metadataBase: new URL(process.env.NODE_ENV === 'production' 
    ? 'https://galapagos.viajes' 
    : 'http://localhost:3001')
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
