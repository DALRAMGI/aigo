import { guideSteps } from './scene-guide';

test('잘 모르겠으면 다친 사람이 있는 흐름과 같다', () => {
  expect(guideSteps('unsure', false)).toEqual(guideSteps('yes', false));
  expect(guideSteps('yes', false)[0].id).toBe('in-119');
});

test('차만 부딪힘은 사진이 차 옮기기보다 먼저다', () => {
  const ids = guideSteps('no', false).map((s) => s.id);
  expect(ids.indexOf('mi-photo')).toBeLessThan(ids.indexOf('mi-move'));
});

test('고속도로면 대피 단계가 맨 앞이고, 겹치는 비상등 단계는 빠진다', () => {
  const ids = guideSteps('no', true).map((s) => s.id);
  expect(ids.slice(0, 5)).toEqual(['hw-light', 'hw-out', 'hw-triangle', 'hw-call', 'hw-tow']);
  expect(ids).not.toContain('mi-light');
  expect(guideSteps('yes', true).map((s) => s.id)).not.toContain('in-safe');
});

test('단계 id가 겹치지 않는다', () => {
  for (const injury of ['yes', 'no'] as const) {
    for (const hw of [true, false]) {
      const ids = guideSteps(injury, hw).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  }
});
