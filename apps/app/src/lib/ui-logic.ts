export type Seg = 'on' | 'soft' | 'off';

// 과실 게이지: n칸 중 [min, max]와 겹치는 칸을 켠다. 점 범위는 그 값의 칸 하나.
export function faultSegments(min: number, max: number, n = 10): Seg[] {
  const w = 100 / n;
  const point = Math.min(Math.floor(min / w), n - 1);
  return Array.from({ length: n }, (_, i): Seg => {
    const on = min === max ? i === point : w * i < max && w * i + w > min;
    return on ? 'on' : 'off';
  });
}

// 진행 단계 막대: 끝난 칸 on, 진행 중인 현재 칸 soft.
export function stageSegments(stageIndex: number, total: number, state: 'running' | 'done' | 'failed'): Seg[] {
  return Array.from({ length: total }, (_, i): Seg => {
    if (state === 'done') return 'on';
    if (i < stageIndex) return 'on';
    return state === 'running' && i === stageIndex ? 'soft' : 'off';
  });
}

// 홈 숫자. capped는 목록이 요청 상한(100)만큼 왔다는 뜻.
export function homeCounts(items: { status: string }[], capped: boolean) {
  return {
    total: capped ? '100+' : String(items.length),
    done: items.filter((i) => i.status === 'done').length,
    running: items.filter((i) => i.status === 'queued' || i.status === 'processing').length,
  };
}
