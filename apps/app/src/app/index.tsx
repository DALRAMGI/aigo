import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

// `/`는 로그인 여부와 상관없이 열려야 한다. 그룹 안에 두면 로그아웃 상태 첫 화면이 Unmatched Route가 된다.
export default function Index() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? '/home' : '/sign-in'} />;
}
