import { useClerk } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, ErrorText, styles } from '@/components/ui';
import { useApi } from '@/lib/api';
import type { ApiFailure } from '@/lib/api';

export default function AccountScreen() {
  const api = useApi();
  const { signOut } = useClerk();
  const [me, setMe] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('/api/v1/me').then(setMe, (e: ApiFailure) => setError(e.message));
    // api는 getToken이 바뀔 때만 새로 만들어진다.
  }, [api]);

  const remove = () =>
    Alert.alert('탈퇴', '계정과 분석 기록이 모두 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('/api/v1/me', { method: 'DELETE' });
            await signOut();
          } catch (e) {
            setError((e as ApiFailure).message);
          }
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>계정</Text>
      {me ? <Text>{JSON.stringify(me, null, 2)}</Text> : null}
      <ErrorText>{error}</ErrorText>
      <Button label="로그아웃" secondary onPress={() => signOut()} />
      <Button label="탈퇴" onPress={remove} />
    </View>
  );
}
