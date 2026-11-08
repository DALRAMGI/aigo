import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme';

// 짙은 요약 카드
export function HeroCard({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <View style={{ backgroundColor: color.ink, borderRadius: radius.card, padding: space[4], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={[type.title, { color: color.white }]}>{title}</Text>
          {subtitle ? <Text style={[type.caption, { color: '#A0A0A0' }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}
