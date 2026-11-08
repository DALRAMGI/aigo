import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { RecentAnalyses } from '@/components/AnalysisRow';
import { Wordmark } from '@/components/Wordmark';
import { Button, HeroCard, Icon, Screen, StatTile } from '@/components/ui';
import type { Analysis } from '@/lib/analysis';
import { useApi } from '@/lib/api';
import { homeCounts } from '@/lib/ui-logic';
import { color } from '@/theme';

export default function HomeScreen() {
  const api = useApi();
  const router = useRouter();
  const [items, setItems] = useState<Analysis[]>([]);

  // 내 분석과 같은 요청. 실패하면 0으로 둔다(홈은 오류를 따로 보이지 않는다).
  useFocusEffect(
    useCallback(() => {
      api<{ items: Analysis[] }>('/api/v1/analyses?limit=100').then((r) => setItems(r.items), () => {});
    }, [api]),
  );
  const n = homeCounts(items, items.length >= 100);

  return (
    <Screen scroll tabInset>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Wordmark height={32} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계정"
          onPress={() => router.push('/account')}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="user" size={18} color={color.ink} />
        </Pressable>
      </View>
      <HeroCard title="사고 영상, 바로 분석해요" subtitle="영상을 올리면 과실 비율과 근거 장면을 알려드려요">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile tone="dark" label="전체" value={n.total} />
          <StatTile tone="dark" label="완료" value={n.done} />
          <StatTile tone="dark" label="분석 중" value={n.running} />
        </View>
      </HeroCard>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} label="영상 분석하기" icon="upload" onPress={() => router.push('/upload')} />
        <Button style={{ flex: 1 }} label="현장 모드" variant="danger" icon="alert" onPress={() => router.push('/emergency')} />
      </View>
      {items.length ? <RecentAnalyses items={items} /> : null}
    </Screen>
  );
}
