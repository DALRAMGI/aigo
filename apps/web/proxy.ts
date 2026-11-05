import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { loginPath } from "./lib/login-path";

const PROTECTED = ["/account", "/analyses", "/checkout"];

// 화면 진입만 막는다. 데이터 권한은 API가 Bearer 토큰으로 따로 확인한다.
export default clerkMiddleware(
  async (auth, req) => {
    const { pathname, search } = req.nextUrl;
    if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const { userId } = await auth();
    if (userId) return;
    // 프록시 뒤에서는 req.url의 호스트가 공개 주소와 다를 수 있어 전달 헤더로 만든다.
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    return NextResponse.redirect(new URL(loginPath(pathname, search), `${proto}://${host}`));
  },
  { signInUrl: "/login", signUpUrl: "/signup" },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};
