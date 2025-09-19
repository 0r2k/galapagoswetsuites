import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';

// Configuración de i18n
const intlMiddleware = createIntlMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'en'
});

export async function middleware(req: NextRequest) {
  // Rutas que no deben pasar por internacionalización
  const adminRoutes = ['/admin']
  const isAdminRoute = adminRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )
  
  // Solo aplicar middleware de internacionalización si NO es una ruta de admin
  if (!isAdminRoute) {
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

  // Rutas que requieren ser administrador (reutilizando la variable anterior)
  // const adminRoutes = [
  //   '/admin',
  // ]

  // Verificar si la ruta actual está en las rutas de administrador
  const isAdminRouteCheck = adminRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  // Si es una ruta de administrador, verificar si el usuario es administrador
  if (isAdminRouteCheck && session) {
    // El usuario ya está en la sesión, no necesitamos obtenerlo de nuevo
    const user = session.user
    
    // Verificar si el usuario es administrador (por su email)
    // En un entorno real, esto debería verificarse con un rol en la base de datos
    if (user?.email !== 'cecheverria@gmail.com') {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
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
    '/checkout/:path*',
    '/checkout/confirmation/:path*',
  ],
}