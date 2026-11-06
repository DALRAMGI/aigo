import { File, UploadType } from 'expo-file-system';
import { ApiFailure } from './api';
import type { components } from './api.gen';

export type UploadTicket = components['schemas']['UploadTicket'];

export const MAX_BYTES = 200 * 1024 * 1024; // 서버 기본값과 같다. 서버가 다시 확인한다.
const ATTEMPTS = 3;
const UPLOAD_FAILED = '영상을 올리지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
const MIME_EXT: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-msvideo': '.avi',
};
const EXTENSIONS = /\.(mp4|mov|webm|avi)$/i;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export function isTicketExpired(ticket: UploadTicket, now: Date): boolean {
  return now.getTime() >= Date.parse(ticket.expires_at);
}

/** 선택기는 파일 이름이 없거나 확장자 없는 id만 줄 수 있다. 이름 → URI 끝 → MIME 순으로 확장자를 찾는다. */
export function videoName(uri: string, name?: string | null, mimeType?: string | null): string {
  const base = name || decodeURIComponent(uri.split('?')[0].split('/').pop() ?? '') || 'video';
  return EXTENSIONS.test(base) ? base : base + (MIME_EXT[mimeType ?? ''] ?? '');
}

/** 문제가 있으면 사용자에게 보여 줄 문구를, 없으면 빈 문자열을 돌려준다. */
export function checkVideo(name: string, size: number): string {
  if (!EXTENSIONS.test(name)) return 'mp4, mov, webm, avi 영상만 올릴 수 있습니다.';
  if (!(size > 0)) return '빈 파일입니다. 다른 파일을 골라 주세요.';
  if (size > MAX_BYTES) return `200MB 이하 영상만 올릴 수 있습니다. 이 파일은 ${mb(size)}입니다.`;
  return '';
}

/** 파일을 읽지 않고 크기만 구한다. file://, content:// 모두 expo-file-system이 처리한다. */
export const fileSize = (uri: string): number => new File(uri).size;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 서명 URL로 파일을 그대로 PUT한다. 네이티브가 파일을 흘려 보내므로 영상을 메모리에 올리지 않는다.
 * 실패하면 같은 티켓으로 3번까지 시도한다(분석을 새로 만들면 하루 한도가 줄어든다).
 */
export async function uploadVideo(
  ticket: UploadTicket,
  uri: string,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    onProgress(0);
    try {
      const task = new File(uri).createUploadTask(ticket.upload_url, {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        headers: ticket.upload_headers,
        signal,
        onProgress: ({ bytesSent, totalBytes }) => onProgress(totalBytes > 0 ? bytesSent / totalBytes : 0),
      });
      const res = await task.uploadAsync();
      if (res.status >= 200 && res.status < 300) return;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
    if (attempt < ATTEMPTS) await sleep(1000 * attempt);
  }
  throw new ApiFailure(0, 'UPLOAD_FAILED', UPLOAD_FAILED);
}
