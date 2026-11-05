const STORE_KEY = "dashpi:after-auth";

/** 사이트 내부 경로만 허용한다. 그 밖(외부 URL, //host, 스킴)은 "/"로 돌린다. */
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  try {
    return new URL(raw, "http://local.invalid").origin === "http://local.invalid" ? raw : "/";
  } catch {
    return "/";
  }
}

/** finalize({navigate})에 넘기는 이동 함수. 세션 작업이 남아 있으면 이동하지 않는다. */
export function navigateTo(push: (url: string) => void, dest: string) {
  return ({ session, decorateUrl }: { session: { currentTask?: unknown } | null; decorateUrl: (u: string) => string }) => {
    if (session?.currentTask) return;
    const url = decorateUrl(safeRedirect(dest));
    if (url.startsWith("http")) window.location.href = url;
    else push(url);
  };
}

// 소셜 로그인은 외부 사이트를 거치므로 돌아올 곳을 탭 저장소에 잠시 둔다.
export function rememberRedirect(dest: string) {
  try {
    sessionStorage.setItem(STORE_KEY, safeRedirect(dest));
  } catch {}
}

export function takeRedirect(): string {
  try {
    const dest = safeRedirect(sessionStorage.getItem(STORE_KEY));
    sessionStorage.removeItem(STORE_KEY);
    return dest;
  } catch {
    return "/";
  }
}
