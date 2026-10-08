import { useMemo } from 'react'
import { talkStats } from '../engine'
import { phaseLabel } from '../library'
import { readOldPlan } from '../parse'
import type { Plan } from '../types'

// The signature view: one class period before and after, teacher talk versus students doing.
export function PeriodBars({ oldPlan, plan }: { oldPlan: string; plan: Plan }) {
  const before = useMemo(() => readOldPlan(oldPlan), [oldPlan])
  const after = talkStats(plan)
  const total = plan.context.minutes
  const beforeTotal = before.talkMinutes + before.activeMinutes || total
  const pct = (m: number, t: number) => `${(m / t) * 100}%`

  return (
    <section className="overflow-hidden rounded-[1.25rem] bg-board text-on-board" aria-label="เวลาครูพูดเทียบกับเวลานักเรียนลงมือ">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
        <div className="min-w-0 space-y-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.875rem]">
              <span className="text-on-board-2">แผนเดิม</span>
              {before.steps.length > 0 && <span className="num text-on-board-2">ครูพูด {before.talkMinutes} นาที จาก {beforeTotal}</span>}
            </div>
            {before.steps.length ? (
              <div className="flex h-10 overflow-hidden rounded-lg" role="img" aria-label={`แผนเดิม ครูพูด ${before.talkMinutes} นาที นักเรียนลงมือ ${before.activeMinutes} นาที`}>
                <span className="bar-in bg-talk" style={{ width: pct(before.talkMinutes, beforeTotal) }} />
                <span className="bar-in bg-chalk" style={{ width: pct(before.activeMinutes, beforeTotal), animationDelay: '120ms' }} />
              </div>
            ) : (
              <p className="flex h-10 items-center rounded-lg border border-dashed border-on-board/40 px-3 text-[0.875rem] text-on-board-2">อ่านขั้นตอนของแผนเดิมไม่ได้ จึงเทียบไม่ได้ ใส่ขั้นตอนแบบ “1. ครู… (10 นาที)” เพื่อเทียบ</p>
            )}
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.875rem]">
              <span className="font-semibold">แผนใหม่ {plan.version > 1 ? `ครั้งที่ ${plan.version}` : ''}</span>
              <span className="num">ครูพูด {after.talk} นาที จาก {after.total}</span>
            </div>
            <div className="flex h-10 gap-[3px] overflow-hidden rounded-lg" role="img" aria-label={plan.stages.map((s) => `${phaseLabel(s.phase)} ${s.minutes} นาที`).join(', ')}>
              {plan.stages.map((s, i) => {
                const talk = Math.round(s.minutes * s.talkShare)
                return (
                  <span key={i} className="flex h-full" style={{ width: pct(s.minutes, total) }}>
                    <span className="bar-in h-full bg-talk" style={{ width: pct(talk, s.minutes), animationDelay: `${200 + i * 90}ms` }} />
                    <span className="bar-in h-full bg-chalk" style={{ width: pct(s.minutes - talk, s.minutes), animationDelay: `${260 + i * 90}ms` }} />
                  </span>
                )
              })}
            </div>
            <div className="mt-1.5 flex gap-[3px] text-[0.75rem] text-on-board-2">
              {plan.stages.map((s, i) => <span key={i} className="truncate" style={{ width: pct(s.minutes, total) }}>{phaseLabel(s.phase)} {s.minutes}′</span>)}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem] text-on-board-2">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-talk" />ครูพูด อธิบาย สรุป</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-chalk" />นักเรียนคิด คุย ลงมือ</span>
          </p>
        </div>
        <div className="border-t border-on-board/20 pt-5 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <p className="text-[0.875rem] text-on-board-2">นักเรียนได้ลงมือ</p>
          <p className="font-[family-name:var(--font-display)] text-[3.25rem] font-semibold leading-none text-chalk num">{after.active}<span className="ml-1 text-[1.25rem] text-on-board"> นาที</span></p>
          <p className="mt-2 text-[0.875rem] text-on-board-2">{before.steps.length ? `จากเดิม ${before.activeMinutes} นาที · ` : ''}เวลาโดยประมาณจากบทบาทครูในแต่ละขั้น</p>
        </div>
      </div>
    </section>
  )
}
