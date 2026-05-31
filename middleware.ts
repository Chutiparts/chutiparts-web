// middleware.ts — Protects /admin/* routes
// Place at PROJECT ROOT (not in app/)

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Skip auth for login & forbidden pages
  if (pathname === '/admin/login' || pathname === '/admin/forbidden') {
    return NextResponse.next()
  }

  // Phase 1 VIN Check: unlisted URL (security via obscurity)
  // V2: replace with proper Supabase Auth admin role check
  if (pathname.startsWith('/admin/vin-check')) {
    return NextResponse.next()
  }
  try {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Not logged in → redirect to login
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const adminRoles = ['admin_content', 'admin_sales', 'admin_super']
    if (!profile || !adminRoles.includes(profile.role)) {
      return NextResponse.redirect(new URL('/admin/forbidden', request.url))
    }

    return response
  } catch (error) {
    // On any error, redirect to login (fail closed)
    const loginUrl = new URL('/admin/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
