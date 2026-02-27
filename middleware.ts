import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';

// Configuración de i18n
const intlMiddleware = createIntlMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'en'
});

export async function middleware(req: NextRequest) {
  // Rutas internas que no deben pasar por internacionalización
  const internalRoutes = ['/admin', '/calendar']
  const isInternalRoute = internalRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )
  
  // Solo aplicar middleware de internacionalización si NO es una ruta interna
  if (!isInternalRoute) {
    const intlResponse = intlMiddleware(req);
    if (intlResponse) {
      return intlResponse;
    }
  }
  
  const res = NextResponse.next()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan variables de entorno de Supabase para el servidor')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  })
  
  // Verificar si el usuario está autenticado usando cookies
  const authCookie = req.cookies.get('sb-auth-token')?.value
  let session = null
  
  if (authCookie) {
    const { data } = await supabase.auth.getUser(authCookie)
    if (data?.user) {
      session = { user: data.user }
    }
  }

  // Si es una ruta interna, verificar permisos
  if (isInternalRoute) {
    // Si no hay sesión, redirigir al login
    if (!session?.user) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    const user = session.user
    
    // Consultar el rol del usuario en la base de datos
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single()
      
    if (error || !userData) {
      // Si hay error o no se encuentra el usuario, denegar acceso
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }

    const role = userData.role

    // Validar acceso según la ruta y el rol
    if (req.nextUrl.pathname.startsWith('/admin')) {
      if (role !== 'admin') {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/'
        return NextResponse.redirect(redirectUrl)
      }
    } else if (req.nextUrl.pathname.startsWith('/calendar')) {
      if (role !== 'admin' && role !== 'calendar_viewer') {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/'
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return res
}

// Configurar las rutas que deben pasar por el middleware
export const config = {
  matcher: [
    '/',
    '/(es|en)/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
    '/calendar/:path*',
    '/sizes/:path*',
    '/checkout/:path*',
    '/checkout/confirmation/:path*',
    '/review/:path*',
  ],
}