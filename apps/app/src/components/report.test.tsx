// analysis.ts가 api.ts를 거쳐 Clerk를 불러오고, Clerk는 타이머를 남긴다.
jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
const mockPlayer = { pause: jest.fn(), currentTime: 0, loop: true, status: 'idle' };
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return { useVideoPlayer: () => mockPlayer, VideoView: View };
});
jest.mock('expo', () => ({ ...jest.requireActual('expo'), useEvent: (_p: unknown, _e: string, init: unknown) => init }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Analysis, Report } from '@/lib/analysis';
import { ProgressView, ReportView } from './analysis';

const report: Report = {
  involvement: 'party',
  reason: null,
  accident_type: '진로변경 중 충돌',
  summary: '상대 차가 차로를 바꾸다 부딪혔습니다.',
  collision_t: 11.2,
  confidence: 'medium',
  severity: 'low',
  timeline: [{ t: 9, text: '상대 차가 왼쪽에서 차로를 바꿈' }],
  facts: [],
  unseen: ['신호 상태'],
  fault: { chart_id: '차43-2', chart_title: '진로변경 사고', source_url: 'https://example.com', me: 'A', base: 30, my_min: 20, my_max: 40, steps: [], unknown: [], laws: [], cases: [] },
  fault_note: null,
  serious_violations: [],
  favorable: [],
  unfavorable: [],
  actions_now: [],
  actions_later: [],
};

const analysis = (r: Partial<Analysis>): Analysis => ({
  id: 12,
  status: 'done',
  stage: null,
  progress: [],
  report,
  playback_url: 'https://example.com/v.mp4',
  overlay_url: null,
  error: null,
  created_at: '2026-11-08T00:00:00Z',
  ...r,
});

test('요약 탭에 예상 범위 게이지와 기준 도표가 보이고, 근거 탭을 누르면 onTab이 불린다', async () => {
  const onTab = jest.fn();
  await render(<ReportView analysis={analysis({})} onReload={() => {}} tab="summary" onTab={onTab} />);
  expect(screen.getByLabelText('예상 범위 20~40%')).toBeTruthy();
  expect(screen.getByLabelText('기준 도표 차43-2')).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: '근거' }));
  expect(onTab).toHaveBeenCalledWith('evidence');
});

test('요약 탭의 충돌 시각을 누르면 근거 탭으로 바꾼다', async () => {
  const onTab = jest.fn();
  await render(<ReportView analysis={analysis({})} onReload={() => {}} tab="summary" onTab={onTab} />);
  await fireEvent.press(screen.getByRole('button', { name: '0:11 장면으로 이동' }));
  expect(onTab).toHaveBeenCalledWith('evidence');
});

test('사고 장면이 없으면 탭이 없다', async () => {
  const none = { ...report, involvement: 'none' as const, fault: null, reason: '충돌이 보이지 않습니다' };
  await render(<ReportView analysis={analysis({ report: none })} onReload={() => {}} tab="summary" onTab={() => {}} />);
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.getByText('충돌이 보이지 않습니다')).toBeTruthy();
});

test('진행 화면은 단계 4/6을 보인다', async () => {
  await render(<ProgressView analysis={analysis({ status: 'processing', stage: 'focus', report: null })} stale={false} />);
  expect(screen.getByLabelText(/단계 4\/6/)).toBeTruthy();
});

test('주의 문구는 "주의"로 읽힌다', async () => {
  await render(<ReportView analysis={analysis({})} onReload={() => {}} tab="summary" onTab={() => {}} />);
  expect(screen.getByLabelText('주의 영상 기반 AI 추정이며 법적 판단이 아닙니다')).toBeTruthy();
});

test('근거 탭을 떠나면 영상을 멈춘다', async () => {
  const props = { analysis: analysis({}), onReload: () => {}, onTab: () => {} };
  const { rerender } = await render(<ReportView {...props} tab="evidence" />);
  mockPlayer.pause.mockClear();
  await rerender(<ReportView {...props} tab="summary" />);
  expect(mockPlayer.pause).toHaveBeenCalled();
});
