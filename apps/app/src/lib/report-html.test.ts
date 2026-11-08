jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));

import type { Report } from './analysis';
import { reportHtml } from './report-html';

const evil = '<script>alert("x")</script> & \'q\'';
const base: Report = {
  involvement: 'party',
  reason: evil,
  accident_type: evil,
  summary: evil,
  collision_t: 7,
  confidence: 'high',
  severity: 'low',
  timeline: [{ t: 1, text: evil }],
  facts: [],
  unseen: [evil],
  fault: {
    chart_id: 'c', chart_title: evil, source_url: evil, me: 'A', base: 50, my_min: 40, my_max: 60,
    steps: [{ label: evil, delta: -10, evidence: { t: 2, text: evil } }],
    unknown: [evil],
    laws: [],
    cases: [],
  },
  fault_note: evil,
  serious_violations: [{ item: evil, likelihood: 'low', evidence: { t: 3, text: evil }, party: 'unknown' }],
  favorable: [evil],
  unfavorable: [evil],
  actions_now: [evil],
  actions_later: [evil],
};

test('escapes_html_in_report_text', () => {
  for (const r of [base, { ...base, involvement: 'none' as const }, { ...base, fault: null, involvement: 'witness' as const }]) {
    const html = reportHtml(r, '2026-11-06T00:00:00Z');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"x"');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;');
  }
});

test('includes_reference_only_notice', () => {
  for (const r of [base, { ...base, involvement: 'none' as const }]) {
    expect(reportHtml(r, '2026-11-06T00:00:00Z')).toContain('주의: 영상 기반 AI 추정이며 법적 판단이 아닙니다');
  }
  expect(reportHtml(base, '2026-11-06T00:00:00Z')).not.toMatch(/<(img|video)/);
});

test('사고 장면을 못 찾은 레포트에도 놓쳤을 수 있다는 안내를 넣는다', () => {
  const html = reportHtml({ ...base, involvement: 'none', reason: '충돌 장면 없음' }, '2026-11-07T00:00:00Z');
  expect(html).toContain('놓쳤을 수 있습니다');
});

test('prints_laws_and_cases_escaped_without_links', () => {
  const fault = { ...base.fault!, laws: [{ name: '도로교통법', article: '제19조', title: evil, url: 'https://x.example/?a=1&b=2' }], cases: [{ court: '대법원', date: '1986.12.9.', number: '86다카1551', url: 'https://x.example' }] };
  const html = reportHtml({ ...base, fault }, '2026-11-06T00:00:00Z');
  expect(html).toContain('관련 법규');
  expect(html).toContain('도로교통법 제19조(&lt;script&gt;');
  expect(html).toContain('참고 판례');
  expect(html).toContain('대법원 1986.12.9. 86다카1551');
  expect(html).not.toContain('<a ');
  const none = reportHtml({ ...base, fault: { ...fault, laws: [], cases: [] } }, '2026-11-06T00:00:00Z');
  expect(none).not.toContain('관련 법규');
  expect(none).not.toContain('참고 판례');
});
