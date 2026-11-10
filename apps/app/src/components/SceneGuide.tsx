import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, ConsentSwitch, Icon, type IconName } from '@/components/ui';
import { guideSteps, INJURY_OPTIONS, type GuideAction, type GuideStep, type Injury } from '@/lib/scene-guide';
import { color, radius, space, type } from '@/theme';

export type GuideHandlers = Record<GuideAction, () => void>;
const ACTION_LOOK: Record<GuideAction, { label: string; icon: IconName }> = {
  call112: { label: '112 전화', icon: 'phone' },
  call119: { label: '119 전화', icon: 'phone' },
  callEx: { label: '무료 견인 1588-2504', icon: 'tow' },
  insurer: { label: '보험사 전화', icon: 'phone' },
  photo: { label: '현장 사진 촬영', icon: 'camera' },
};

function StepRow({ n, step, done, open, onToggleDone, onToggleOpen, handlers, last }: {
  n: number; step: GuideStep; done: boolean; open: boolean; onToggleDone: () => void; onToggleOpen: () => void; handlers: GuideHandlers; last: boolean;
}) {
  const accent = step.urgent && !done;
  return (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      {/* 표지판처럼 읽히는 아이콘. 누르면 완료로 표시하고, 다음 단계로 선을 잇는다. */}
      <View style={{ alignItems: 'center' }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${n}단계 ${step.title} 완료`}
          accessibilityState={{ checked: done }}
          onPress={onToggleDone}
          hitSlop={4}
          style={{ width: 44, height: 44, borderRadius: radius.icon, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? color.brand : accent ? color.danger : color.gray3 }}
        >
          <Icon name={done ? 'check' : step.icon} size={22} color={done ? color.onBrand : accent ? color.white : color.ink} />
        </Pressable>
        {last ? null : <View style={{ flex: 1, width: 2, minHeight: 10, backgroundColor: color.gray4, marginVertical: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : space[3] }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${step.title}, ${open ? '접기' : '자세히'}`} onPress={onToggleOpen}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space[2] }}>
          <Text style={[type.micro, { color: accent ? color.danger600 : color.gray9, width: 14 }]}>{n}</Text>
          <Text style={[type.label, { flex: 1, fontSize: 15, color: done ? color.gray9 : color.gray12, textDecorationLine: done ? 'line-through' : 'none' }]}>{step.title}</Text>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={14} color={color.gray9} /></View>
        </Pressable>
        {open ? (
          <View style={{ gap: space[3], marginTop: space[1] }}>
            <Text style={[type.caption, { color: color.gray11, lineHeight: 20 }]}>{step.detail}</Text>
            {step.actions?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                {step.actions.map((a) => (
                  <Button key={a} label={ACTION_LOOK[a].label} icon={ACTION_LOOK[a].icon} size="md" variant={a === 'call119' ? 'emergency' : 'secondary'} onPress={handlers[a]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// 사고 현장 모드: 질문 하나와 고속도로 여부로 지금 할 일을 순서대로 보여 준다.
export function SceneGuide({ handlers }: { handlers: GuideHandlers }) {
  const [injury, setInjury] = useState<Injury | null>(null);
  const [highway, setHighway] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  const steps = injury ? guideSteps(injury, highway) : [];
  const doneCount = steps.filter((s) => done.has(s.id)).length;
  const toggle = (set: Set<string>, id: string) => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; };
  // 질문에 답하면 첫 단계를 펼쳐 둔다.
  const choose = (v: Injury) => { setInjury(v); setOpen(guideSteps(v, highway)[0].id); };

  return (
    <>
      <Card title="다친 사람이 있나요?">
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          {INJURY_OPTIONS.map((o) => {
            const on = injury === o.value;
            const danger = o.value === 'yes';
            return (
              <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose(o.value)}
                style={{ flex: 1, height: 48, borderRadius: radius.row, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? (danger ? color.danger : color.ink) : color.gray2, borderWidth: on ? 0 : 1, borderColor: color.gray4 }}>
                <Text style={[type.label, { color: on ? color.white : color.gray12 }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 1, backgroundColor: color.gray4 }} />
        <ConsentSwitch value={highway} onChange={setHighway} label="고속도로·자동차전용도로예요" />
        {injury === 'unsure' ? <Text style={[type.caption, { color: color.gray11 }]}>확실하지 않으면 다친 사람이 있다고 보고 안내해요.</Text> : null}
      </Card>

      {injury ? (
        <Card title="지금 할 일" action={{ label: `${doneCount}/${steps.length} 완료`, onPress: () => setDone(new Set()) }}>
          <View>
            {steps.map((s, i) => (
              <StepRow key={s.id} n={i + 1} step={s} done={done.has(s.id)} open={open === s.id} last={i === steps.length - 1} handlers={handlers}
                onToggleDone={() => setDone((d) => toggle(d, s.id))} onToggleOpen={() => setOpen(open === s.id ? null : s.id)} />
            ))}
          </View>
          <Text style={[type.micro, { color: color.gray9 }]}>아이콘을 누르면 완료로 표시돼요. 제목을 누르면 자세한 방법이 열려요.</Text>
        </Card>
      ) : (
        <Text style={[type.caption, { color: color.gray11, textAlign: 'center' }]}>답을 고르면 지금 할 일을 순서대로 알려 드려요.</Text>
      )}
    </>
  );
}
