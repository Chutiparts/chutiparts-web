// middleware.ts — Protects /admin/* routes
// Place at PROJECT ROOT (not in app/)

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // === Ops role gate: team เข้าได้เฉพาะหน้าที่อนุญาต · owner-only → /unauthorized ===
  if (pathname.startsWith('/ops-x7k2m9')) {
    const TEAM_ALLOWED = ['/ops-x7k2m9/parts-desk', '/ops-x7k2m9/sync-stock', '/ops-x7k2m9/sourcing', '/ops-x7k2m9/sell', '/ops-x7k2m9/unauthorized']
    const allowed = TEAM_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'))
    const isOwner = request.cookies.get('ops_admin')?.value === process.env.ADMIN_OPS_SECRET
    const team = process.env.TEAM_OPS_SECRET
    const isTeam = !isOwner && !!team && request.cookies.get('ops_team')?.value === team
    if (isTeam && !allowed) {
      return NextResponse.redirect(new URL('/ops-x7k2m9/unauthorized', request.url))
    }
    return NextResponse.next()
  }

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
  matcher: ['/admin/:path*', '/ops-x7k2m9/:path*'],
}
