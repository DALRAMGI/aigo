// 사고 현장 모드 상황별 안내. 출처: 한국도로공사 2차 사고 예방 행동요령(비트밖스), 도로교통법 제54조(사고 후 조치),
// 도로공사 긴급견인(1588-2504). 안전삼각대는 현재 정해진 거리 기준이 없어 "뒤차가 충분히 볼 수 있는 곳"으로 안내한다.

export type Injury = 'yes' | 'no' | 'unsure';
export type GuideAction = 'call112' | 'call119' | 'callEx' | 'insurer' | 'photo';
import type { IconName } from '@/components/ui';

export type GuideStep = { id: string; icon: IconName; title: string; detail: string; actions?: GuideAction[]; urgent?: boolean };

export const INJURY_OPTIONS: { value: Injury; label: string }[] = [
  { value: 'yes', label: '네, 있어요' },
  { value: 'no', label: '아니요, 차만' },
  { value: 'unsure', label: '모르겠어요' },
];

const HIGHWAY: GuideStep[] = [
  { id: 'hw-light', icon: 'trunk', title: '비상등 켜고 트렁크 열기', detail: '뒤에서 오는 차에 멈춰 선 차가 있다는 걸 알려요.', urgent: true },
  { id: 'hw-out', icon: 'exit', title: '가드레일 밖으로 대피', detail: '차 안이나 차 앞뒤에 서 있지 마세요. 동승자도 함께 가드레일 밖으로 나가요.', urgent: true },
  { id: 'hw-triangle', icon: 'warnsign', title: '안전삼각대는 할 수 있을 때만', detail: '도로 위를 무리하게 걷지 마세요. 뒤차가 충분히 볼 수 있는 곳에 두고, 커브나 오르막 뒤라면 더 멀리 둬요.' },
  { id: 'hw-call', icon: 'siren', title: '112에 신고하기', detail: '위치는 근처 이정표의 숫자로 말하면 정확해요. 다친 사람이 있으면 119도 함께 불러요.', actions: ['call112', 'call119'] },
  { id: 'hw-tow', icon: 'tow', title: '무료 견인 부르기', detail: '한국도로공사가 가까운 휴게소·졸음쉼터까지 무료로 옮겨 줘요(24시간). 먼저 온 견인차에 바로 맡기지 말고 누가 보낸 차인지 확인하세요. 그다음 정비소까지는 보험사 긴급출동을 부르면 돼요.', actions: ['callEx', 'insurer'] },
];

const INJURED: GuideStep[] = [
  { id: 'in-119', icon: 'medical', title: '119에 전화하기', detail: '위치, 다친 사람 수, 상태(의식이 있는지, 피가 나는지)를 말해요. 전화를 끊지 말고 안내를 따르세요.', actions: ['call119'], urgent: true },
  { id: 'in-safe', icon: 'hazard', title: '2차 사고 막기', detail: '비상등을 켜고, 차가 오가는 곳이면 안전한 곳으로 피해요.' },
  { id: 'in-care', icon: 'user', title: '다친 사람 곁에 있기', detail: '목이나 허리를 다쳤을 수 있으면 옮기지 마세요. 불이 나거나 차에 치일 위험이 있을 때만 옮겨요. 피가 나면 깨끗한 천으로 눌러 주고, 말을 걸어 의식을 확인해요.' },
  { id: 'in-112', icon: 'siren', title: '112에 신고하기', detail: '사람이 다친 사고는 경찰 신고가 필요해요.', actions: ['call112'] },
  { id: 'in-photo', icon: 'camera', title: '안전해진 뒤 현장 기록', detail: '차 위치와 부서진 곳, 주변 도로를 사진으로 남겨요.', actions: ['photo'] },
  { id: 'in-info', icon: 'idcard', title: '상대방 정보 받기', detail: '이름, 연락처, 차량번호, 보험사를 받아 두세요.' },
  { id: 'in-insurer', icon: 'shield', title: '보험사와 가족에게 연락', detail: '보험사에 사고를 접수하고, 아래 알릴 사람 카드로 가족에게 알려요.', actions: ['insurer'] },
];

const MINOR: GuideStep[] = [
  { id: 'mi-light', icon: 'hazard', title: '비상등 켜기', detail: '뒤차가 사고 난 걸 알 수 있게 해요.' },
  { id: 'mi-photo', icon: 'camera', title: '차 옮기기 전에 사진부터', detail: '두 차가 한 화면에 들어오게 멀리서 한 장, 부서진 곳은 가까이서, 차선·신호등·표지판과 상대 번호판까지 찍어요.', actions: ['photo'], urgent: true },
  { id: 'mi-move', icon: 'carmove', title: '안전한 곳으로 차 옮기기', detail: '도로에 그대로 두면 2차 사고 위험이 커요. 갓길이나 가까운 안전한 곳으로 옮겨요.' },
  { id: 'mi-info', icon: 'idcard', title: '상대방 정보 받기', detail: '이름, 연락처, 차량번호, 보험사를 받아요. "제 잘못이에요" 같은 말은 하지 마세요. 과실은 영상과 증거로 정해져요.' },
  { id: 'mi-insurer', icon: 'shield', title: '보험사에 사고 접수', detail: '현장에서 바로 접수하면 처리가 빨라요.', actions: ['insurer'] },
  { id: 'mi-112', icon: 'siren', title: '이럴 땐 112에 신고', detail: '과실 다툼이 있을 때, 상대가 술을 마신 것 같거나 보험이 없을 때, 상대가 그냥 떠나려 할 때 신고해요.', actions: ['call112'] },
];

const OVERLAP = ['mi-light', 'in-safe'];

/** 고속도로면 대피 단계를 맨 앞에 붙인다. 잘 모르겠으면 안전하게 부상 흐름으로 본다. */
export function guideSteps(injury: Injury, highway: boolean): GuideStep[] {
  const base = injury === 'no' ? MINOR : INJURED;
  // 고속도로 단계에 비상등·대피가 있으니 겹치는 단계는 뺀다.
  return highway ? [...HIGHWAY, ...base.filter((s) => !OVERLAP.includes(s.id))] : base;
}
