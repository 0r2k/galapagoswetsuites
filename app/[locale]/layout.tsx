import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import '../globals.css'
import { Toaster } from '@/components/ui/sonner'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Galápagos - Wetsuit & Snorkeling by Chokotrip',
  description: 'Alquiler de equipos de snorkeling y wetsuits en Galápagos. Más de 100 equipos disponibles para explorar la vida marina. Recogida en Santa Cruz, devolución en Santa Cruz o San Cristóbal.',
  icons: "/favicon.webp",
  openGraph: {
    title: 'Galápagos - Wetsuit & Snorkeling by ChokoTrip',
    description: 'Alquiler de equipos de snorkeling y wetsuits en Galápagos. Más de 100 equipos disponibles para explorar la vida marina. Recogida en Santa Cruz, devolución en Santa Cruz o San Cristóbal.',
    url: 'https://galapagos.viajes',
    siteName: 'ChokoTrip Galápagos',
    images: [
      {
        url: '/wetsuits-snorkel.jpg',
        width: 1200,
        height: 630,
        alt: 'Equipos de snorkeling y wetsuits para alquilar en Galápagos',
      },
    ],
    locale: 'es_EC',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galápagos - Wetsuit & Snorkeling by ChokoTrip',
    description: 'Alquiler de equipos de snorkeling y wetsuits en Galápagos. Más de 100 equipos disponibles para explorar la vida marina.',
    images: ['/wetsuits-snorkel.jpg'],
  },
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      <Toaster richColors position="top-center" />
    </NextIntlClientProvider>
  )
}