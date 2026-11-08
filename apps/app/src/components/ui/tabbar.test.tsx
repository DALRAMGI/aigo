import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FloatingTabBar, TAB_ITEMS } from './FloatingTabBar';

function props(navigate = jest.fn()) {
  return {
    state: { index: 2, routes: TAB_ITEMS.map((t) => ({ key: `${t.route}-k`, name: t.route })) },
    emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
    navigateToTab: navigate,
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
}

test('버튼 5개가 순서대로 있고 분석하기가 선택돼 있다', async () => {
  await render(<FloatingTabBar {...props()} />);
  expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['홈', '내 분석', '분석하기', '현장 모드', '계정']);
  expect(screen.getByRole('tab', { name: '분석하기', selected: true })).toBeTruthy();
});

test('계정을 누르면 account 탭으로 이동한다', async () => {
  const navigate = jest.fn();
  await render(<FloatingTabBar {...props(navigate)} />);
  await fireEvent.press(screen.getByRole('tab', { name: '계정' }));
  expect(navigate).toHaveBeenCalledWith('account-k');
});
