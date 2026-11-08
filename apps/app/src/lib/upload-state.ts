type Prev = { fileUri: string | null; attemptUri: string | null };

// 탭을 오가도 고른 영상과 올리던 attempt는 남는다. 다른 영상이 오거나 제출이 끝났을 때만 지운다.
export function nextUploadState(prev: Prev, event: 'shared' | 'picked' | 'submitted' | 'tabReturn', incomingUri?: string): { resetFile: boolean; dropAttempt: boolean } {
  const reset = event === 'submitted' || ((event === 'shared' || event === 'picked') && incomingUri !== prev.fileUri);
  return { resetFile: reset, dropAttempt: reset };
}
