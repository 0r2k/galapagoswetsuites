'use server'

import { cookies } from 'next/headers'

export async function createSession(accessToken: string) {
  // Set the cookie that middleware expects
  const cookieStore = await cookies()
  
  cookieStore.set('sb-auth-token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('sb-auth-token')
}
