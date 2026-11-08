import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, Icon, ListRow, SourceChip, StatusChip, statusTone } from '@/components/ui';
import { STATUS_LABEL, analysisTitle, faultRange, seoulDate, type Analysis } from '@/lib/analysis';
import { color, radius } from '@/theme';

// 내 분석 목록과 홈이 같이 쓰는 분석 한 줄
export function AnalysisRow({ a, onPress, onDelete }: { a: Analysis; onPress: () => void; onDelete?: () => void }) {
  const fault = a.report?.fault ? ` · 내 과실 ${faultRange(a.report.fault)}` : '';
  return (
    <ListRow
      leading={
        <View style={{ width: 44, height: 44, borderRadius: radius.icon, backgroundColor: color.gray3, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="video" size={20} color={color.gray9} />
        </View>
      }
      title={analysisTitle(a)}
      subtitle={`#${a.id} · ${seoulDate(a.created_at)}${fault}`}
      onPress={onPress}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SourceChip source={a.source} />
          <StatusChip tone={statusTone(a.status)} label={STATUS_LABEL[a.status] ?? STATUS_LABEL.processing} />
          {onDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`분석 #${a.id} 삭제`} onPress={onDelete} hitSlop={8}>
              <Icon name="trash" size={18} color={color.gray9} />
            </Pressable>
          ) : null}
        </View>
      }
    />
  );
}

export function RecentAnalyses({ items }: { items: Analysis[] }) {
  const router = useRouter();
  return (
    <Card title="최근 분석" action={{ label: '전체 보기', onPress: () => router.push('/analyses') }}>
      {items.slice(0, 3).map((a) => (
        <AnalysisRow key={a.id} a={a} onPress={() => router.push(`/analyses/${a.id}`)} />
      ))}
    </Card>
  );
}
