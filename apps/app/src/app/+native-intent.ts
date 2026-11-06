// 다른 앱의 공유 메뉴로 열리면(aigo://expo-sharing) 공유 화면으로 보낸다. 그 밖의 딥링크(Clerk 콜백 등)는 그대로 둔다.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') return '/share';
  } catch {
    // URL이 아닌 경로(/upload 등)는 그대로 둔다.
  }
  return path;
}
