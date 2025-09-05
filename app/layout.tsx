import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Script from "next/script";

export const metadata: Metadata = {
  title: 'Galapagos Wet Suit Rental',
  description: 'By Chokotrip',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Paymentez Libraries */}
        {/* <script src="https://cdn.paymentez.com/ccapi/sdk/payment_sdk_stable.min.js" charSet="UTF-8"></script> */}
        <Script src="https://code.jquery.com/jquery-3.5.0.min.js"></Script>
        <Script src="https://cdn.paymentez.com/ccapi/sdk/payment_checkout_3.0.0.min.js"></Script>

      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
