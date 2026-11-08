import { useClerk, useUser } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Card, Icon, ListRow, Screen, TopBar } from '@/components/ui';
import { useApi } from '@/lib/api';
import type { ApiFailure } from '@/lib/api';
import { clearAppCache } from '@/lib/cache';
import { unregisterPush } from '@/lib/push';
import { color, type as t } from '@/theme';

// /products 목록 페이지는 웹에 없다. 상품 목록은 첫 화면의 #products 구역이다.
const PRODUCTS_URL = 'https://aigo.up.railway.app/#products';
const DELETED_BUT_SIGNED_IN = '탈퇴는 완료됐지만 로그아웃하지 못했습니다. 앱을 다시 열어 주세요.';

export default function AccountScreen() {
  const api = useApi();
  const { signOut } = useClerk();
  const email = useUser().user?.primaryEmailAddress?.emailAddress;
  const [error, setError] = useState<string | null>(null);

  const remove = () =>
    Alert.alert('탈퇴', '계정과 분석 기록이 모두 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/v1/me', { method: 'DELETE' });
          } catch (e) {
            setError((e as ApiFailure).message);
            return;
          }
          // 계정은 이미 지워졌다. 로그아웃 실패를 삭제 실패로 보이게 하지 않는다.
          clearAppCache();
          signOut().catch(() => setError(DELETED_BUT_SIGNED_IN));
        },
      },
    ]);

  const chevron = <Icon name="chevron" size={16} color={color.gray9} />;
  return (
    <Screen scroll tabInset>
      <TopBar title="계정" />
      <Card title="이메일">
        <Text style={{ ...t.body, color: color.gray12 }}>{email ?? ''}</Text>
      </Card>
      {error ? <Text style={{ ...t.caption, color: color.danger600 }}>{error}</Text> : null}
      <Card>
        <ListRow
          title="상품 보기"
          trailing={chevron}
          onPress={() => WebBrowser.openBrowserAsync(PRODUCTS_URL).catch(() => setError('상품 페이지를 열지 못했습니다.'))}
        />
        <ListRow
          title="로그아웃"
          trailing={chevron}
          onPress={async () => {
            await unregisterPush(api); // 실패해도 로그아웃은 계속한다.
            clearAppCache();
            signOut().catch(() => setError('로그아웃하지 못했습니다. 다시 시도해 주세요.'));
          }}
        />
        <ListRow title="탈퇴" danger onPress={remove} />
      </Card>
    </Screen>
  );
}
