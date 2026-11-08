import { nextUploadState } from './upload-state';

test('탭을 오가면 아무것도 지우지 않는다', () => {
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'tabReturn')).toEqual({ resetFile: false, dropAttempt: false });
});
test('제출이 끝나면 모두 지운다', () => {
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'submitted')).toEqual({ resetFile: true, dropAttempt: true });
});
test('공유로 다른 영상이 오면 새로 시작한다', () => {
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'shared', 'b')).toEqual({ resetFile: true, dropAttempt: true });
});
test('같은 영상이 다시 공유되면 기존 attempt를 살린다', () => {
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'shared', 'a')).toEqual({ resetFile: false, dropAttempt: false });
});
test('갤러리에서 고른 영상도 같은 규칙이다', () => {
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'picked', 'b')).toEqual({ resetFile: true, dropAttempt: true });
  expect(nextUploadState({ fileUri: 'a', attemptUri: 'a' }, 'picked', 'a')).toEqual({ resetFile: false, dropAttempt: false });
});
