import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, Text } from 'react-native';
import { AnalysisRow } from '@/components/AnalysisRow';
import { Button, Card, EmptyState, Screen, TopBar } from '@/components/ui';
import type { Analysis } from '@/lib/analysis';
import { useApi } from '@/lib/api';
import type { ApiFailure } from '@/lib/api';
import { deleteReportPdf } from '@/lib/cache';
import { color, type as t } from '@/theme';

export default function AnalysesScreen() {
  const api = useApi();
  const router = useRouter();
  const [items, setItems] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ponytail: 서버 최대 100건까지만 보여 준다. 더 쌓이면 offset으로 이어 받는다.
  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: Analysis[] }>('/api/v1/analyses?limit=100')).items);
      setError(null);
    } catch (e) {
      setError((e as ApiFailure).message);
    }
  }, [api]);

  // 상세 화면에서 돌아올 때마다 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const remove = (id: number) =>
    Alert.alert('분석 삭제', '이 분석과 영상 파일을 지웁니다. 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/v1/analyses/${id}`, { method: 'DELETE' });
            deleteReportPdf(id);
            setItems((cur) => cur?.filter((a) => a.id !== id) ?? null);
          } catch (e) {
            const err = e as ApiFailure;
            if (err.status === 404) setItems((cur) => cur?.filter((a) => a.id !== id) ?? null); // 이미 지워졌다.
            else setError(err.message);
          }
        },
      },
    ]);

  return (
    <Screen scroll tabInset refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <TopBar title="내 분석" />
      {error ? <Text style={{ ...t.caption, color: color.danger600 }}>{error}</Text> : null}
      {items === null ? (
        <Text style={{ ...t.body, color: color.gray11 }}>불러오는 중</Text>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon="video" title="아직 분석한 영상이 없어요">
            <Button label="영상 올리기" onPress={() => router.push('/upload')} />
          </EmptyState>
        </Card>
      ) : (
        <Card>
          {items.map((a) => (
            <AnalysisRow key={a.id} a={a} onPress={() => router.push(`/analyses/${a.id}`)} onDelete={() => remove(a.id)} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
