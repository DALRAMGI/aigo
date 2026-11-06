import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';

function Routes() {
  const { isLoaded, isSignedIn } = useAuth();
  // 로딩 중에는 Stack을 그대로 그린다. 오프라인에서 Clerk가 끝내 로드되지 않아도 index와 scene은 열려야 한다.
  // 두 보호 구역은 로딩이 끝나기 전에는 닫아 두어 로그인 화면이 잠깐 보이는 일이 없게 한다.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scene" />
      <Stack.Protected guard={isLoaded && !!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="upload" options={{ headerShown: true }} />
        <Stack.Screen name="analyses/[id]" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={isLoaded && !isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <Routes />
    </ClerkProvider>
  );
}
