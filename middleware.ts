import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TODO: Supabase Auth 接入时启用真实 middleware
// import { updateSession } from "@/lib/supabase/middleware";

export function middleware(_request: NextRequest) {
  // 暂时 pass-through，不拦截任何路由
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/new-analysis/:path*",
    "/runs/:path*",
    "/analysis-report/:path*",
    "/training-data/:path*",
    "/evaluation/:path*",
    "/settings/:path*",
  ],
};
