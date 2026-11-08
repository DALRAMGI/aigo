import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space, tabBarSpace } from '@/theme';

// 회색 바탕 화면 틀. tabInset이면 떠 있는 메뉴만큼 아래를 비운다.
export function Screen({ scroll, tabInset, children, style, refreshControl }: { scroll?: boolean; tabInset?: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; refreshControl?: ReactElement<RefreshControlProps> }) {
  const pad = { paddingHorizontal: space[4], paddingBottom: space[4] + (tabInset ? tabBarSpace : 0), gap: space[3] };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.gray3 }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[pad, style]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
