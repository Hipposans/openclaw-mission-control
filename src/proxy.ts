import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://127.0.0.1:3001",
  "http://localhost:3001",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Exempt health check
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");

  // Same-origin browser requests have no Origin header — allow them
  if (!origin) {
    return NextResponse.next();
  }

  // Dashboard's own frontend (allowed origin) — allow without token
  if (ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.next();
  }

  // Cross-origin: require Bearer token (programmatic/external access)
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (gatewayToken) {
    const authHeader = request.headers.get("authorization");
    const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (provided !== gatewayToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  // Unknown external origin without valid token — block (CSRF protection)
  return NextResponse.json(
    { error: "Forbidden: cross-origin request blocked" },
    { status: 403 }
  );
}

export const config = {
  matcher: "/api/:path*",
};
