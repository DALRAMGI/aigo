import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';

function Routes() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  // 로그인하지 않으면 (auth)로, 로그인하면 (tabs)로 자동으로 옮겨 간다.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="upload" options={{ headerShown: true }} />
        <Stack.Screen name="analyses/[id]" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
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
