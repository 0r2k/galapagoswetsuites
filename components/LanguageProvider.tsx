'use client'

import { useEffect } from 'react'

export function LanguageProvider({
  locale,
  children
}: {
  locale: string
  children: React.ReactNode
}) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <>{children}</>
}
