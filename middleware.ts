import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = process.env.JWT_SECRET || process.env.WORKER_JWT_SECRET || "default-secret-key-change-me"

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value
  const { pathname } = request.nextUrl

  // Define protected routes pattern
  const isProtectedRoute = 
    pathname.startsWith("/dashboard") || 
    pathname.startsWith("/settings") ||
    pathname.startsWith("/work")

  // Verify token function
  const verifyToken = async (token: string) => {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET)
      await jwtVerify(token, secret)
      return true
    } catch (error) {
      return false
    }
  }

  // Protected routes check
  if (isProtectedRoute) {
    if (!token) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // Verify token validity
    const isValid = await verifyToken(token)
    if (!isValid) {
      // Token is invalid/expired - clear it and redirect to login
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      url.searchParams.set("error", "session_expired")
      const response = NextResponse.redirect(url)
      response.cookies.delete("auth_token")
      return response
    }
  }

  // Auth routes (redirect to dashboard if already logged in)
  if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/sign-up")) {
    // If there is an error param (e.g. session_expired), allow access to login page
    if (request.nextUrl.searchParams.has("error")) {
      return NextResponse.next()
    }

    if (token) {
      const isValid = await verifyToken(token)
      if (isValid) {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
      }
      // If token exists but invalid, let them proceed to login (and maybe clear cookie?)
      // We can clear it to be clean
      const response = NextResponse.next()
      response.cookies.delete("auth_token")
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2)$).*)",
  ],
}
