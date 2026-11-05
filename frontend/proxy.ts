import { clerkMiddleware } from "@clerk/nextjs/server";

const PROTECTED = ["/account", "/analyses", "/checkout"];

// 화면 진입만 막는다. 데이터 권한은 API가 Bearer 토큰으로 따로 확인한다.
export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;
    if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) await auth.protect();
  },
  { signInUrl: "/login", signUpUrl: "/signup" },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};
