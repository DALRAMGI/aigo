// useApi만 Clerk를 쓰므로 테스트에서는 네이티브 런타임이 필요한 모듈을 불러오지 않는다.
jest.mock('@clerk/expo', () => ({ useAuth: jest.fn() }));

import { ApiFailure, apiRequest, toApiFailure } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = jest.fn();
const getToken = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  getToken.mockReset().mockResolvedValue('tok-1');
  globalThis.fetch = fetchMock;
});

test('API 오류 본문의 code와 message를 그대로 담는다', async () => {
  const e = await toApiFailure(json(404, { code: 'ANALYSIS_NOT_FOUND', message: '없습니다.' }));
  expect(e).toBeInstanceOf(ApiFailure);
  expect([e.status, e.code, e.message]).toEqual([404, 'ANALYSIS_NOT_FOUND', '없습니다.']);
});

test('형식이 다른 본문은 UNKNOWN_ERROR로 바꾼다', async () => {
  const e = await toApiFailure(new Response('<html>', { status: 502 }));
  expect([e.status, e.code]).toEqual([502, 'UNKNOWN_ERROR']);
});

test('Bearer 토큰을 붙인다', async () => {
  fetchMock.mockResolvedValue(json(200, { ok: true }));
  await expect(apiRequest(getToken, '/api/v1/me')).resolves.toEqual({ ok: true });
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer tok-1');
});

test('401이면 새 토큰으로 한 번 다시 보낸다', async () => {
  getToken.mockResolvedValueOnce('old').mockResolvedValueOnce('new');
  fetchMock.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'x' })).mockResolvedValueOnce(json(200, {}));
  await apiRequest(getToken, '/api/v1/me');
  expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
  expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer new');
});

test('연결 실패는 status 0 NETWORK_ERROR다', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  await expect(apiRequest(getToken, '/api/v1/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
});

test('204는 undefined를 돌려준다', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  await expect(apiRequest(getToken, '/api/v1/me', { method: 'DELETE' })).resolves.toBeUndefined();
});
