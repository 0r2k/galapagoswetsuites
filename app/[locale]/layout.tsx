import type { Metadata } from 'next'
import '../globals.css'
import { Toaster } from '@/components/ui/sonner'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { getSiteContentServer } from '@/lib/db'

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  const siteContent = await getSiteContentServer()

  const title = locale === 'en' ? siteContent?.seo_title_en : siteContent?.seo_title_es
  const description = locale === 'en' ? siteContent?.seo_description_en : siteContent?.seo_description_es
  const ogTitle = locale === 'en' ? siteContent?.og_title_en : siteContent?.og_title_es
  const ogDescription = locale === 'en' ? siteContent?.og_description_en : siteContent?.og_description_es
  const ogImage = locale === 'en' ? siteContent?.og_image_en : siteContent?.og_image_es
  const twitterTitle = locale === 'en' ? siteContent?.twitter_title_en : siteContent?.twitter_title_es
  const twitterDescription = locale === 'en' ? siteContent?.twitter_description_en : siteContent?.twitter_description_es

  return {
    title: title || t('title'),
    description: description || t('description'),
    icons: "/favicon.webp",
    openGraph: {
      title: ogTitle || t('openGraph.title'),
      description: ogDescription || t('openGraph.description'),
      url: 'https://galapagos.viajes',
      siteName: t('openGraph.siteName'),
      images: [
        {
          url: ogImage || (locale === 'es' ? '/wetsuits-snorkel-es.jpg' : '/wetsuits-snorkel-en.jpg'),
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
      title: twitterTitle || t('twitter.title'),
      description: twitterDescription || t('twitter.description'),
      images: [ogImage || '/wetsuits-snorkel.jpg'],
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