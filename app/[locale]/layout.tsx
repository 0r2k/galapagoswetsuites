import type { Metadata } from 'next'
import '../globals.css'
import { Toaster } from '@/components/ui/sonner'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: t('title'),
    description: t('description'),
    icons: "/favicon.webp",
    openGraph: {
      title: t('openGraph.title'),
      description: t('openGraph.description'),
      url: 'https://galapagos.viajes',
      siteName: t('openGraph.siteName'),
      images: [
        {
          url: locale === 'es' ? '/wetsuits-snorkel-es.jpg' : '/wetsuits-snorkel-en.jpg',
          width: 1200,
          height: 630,
          alt: t('openGraph.imageAlt'),
        },
      ],
      locale: locale === 'es' ? 'es_EC' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('twitter.title'),
      description: t('twitter.description'),
      images: ['/wetsuits-snorkel.jpg'],
    },
  }
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