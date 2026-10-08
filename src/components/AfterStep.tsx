import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { adapt } from '../engine'
import { phaseLabel } from '../library'
import { currentPlan, type Store } from '../store'
import type { Feedback, StageResult } from '../types'

const RESULTS: { id: StageResult; label: string }[] = [
  { id: 'worked', label: 'ได้ผลดี' },
  { id: 'ok', label: 'พอใช้' },
  { id: 'failed', label: 'ไม่ได้ผล' },
]

export function AfterStep({ store }: { store: Store }) {
  const { state, update } = store
  const plan = currentPlan(state)
  const [fb, setFb] = useState<Feedback[]>(() => plan.stages.map((_, i) => ({ stage: i, result: 'ok', overtime: false, note: '' })))
  const set = (i: number, patch: Partial<Feedback>) => setFb((f) => f.map((x) => (x.stage === i ? { ...x, ...patch } : x)))

  const makeNext = () => {
    const failedIds = fb.filter((f) => f.result === 'failed').map((f) => plan.stages[f.stage].activityId)
    const next = adapt(plan, fb, state.tried)
    update((s) => ({ ...s, history: [...s.history.slice(0, s.current + 1), next], current: s.current + 1, tried: [...new Set([...s.tried, ...failedIds])], step: 'plan' }))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto max-w-[52rem]">
      <h2 className="text-[clamp(1.5rem,3vw,2rem)]">บันทึกหลังสอน ฉบับที่ {plan.version}</h2>
      <p className="mt-1 text-ink-2">บอกว่าแต่ละขั้นเป็นอย่างไรในห้องจริง ระบบจะเปลี่ยนกิจกรรมที่ไม่ได้ผล ปรับเวลาขั้นที่ไม่ทัน และคงสิ่งที่ได้ผลไว้ในคาบถัดไป</p>
      <ol className="mt-6 space-y-3">
        {plan.stages.map((s, i) => {
          const f = fb[i]
          return (
            <li key={i} className="sheet p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] text-ink-3">{phaseLabel(s.phase)} · <span className="num">{s.minutes} นาที</span></p>
                  <h3 className="text-[1.0625rem]">{s.name}</h3>
                </div>
                <div className="flex rounded-full bg-paper p-1" role="radiogroup" aria-label={`ผลของ${s.name}`}>
                  {RESULTS.map((r) => (
                    <button key={r.id} role="radio" aria-checked={f.result === r.id} onClick={() => set(i, { result: r.id })}
                      className={`rounded-full px-3.5 py-1.5 text-[0.875rem] font-medium transition-colors ${f.result === r.id ? (r.id === 'failed' ? 'bg-pen text-white' : r.id === 'worked' ? 'bg-board text-on-board' : 'bg-ink text-paper') : 'text-ink-2 hover:text-ink'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-[0.9375rem]">
                  <input id={`over-${i}`} type="checkbox" className="size-4 accent-[var(--board)]" checked={f.overtime} onChange={(e) => set(i, { overtime: e.target.checked })} />
                  ไม่ทันเวลา
                </label>
                <input id={`note-${i}`} className="field min-w-[12rem] flex-1" placeholder="เกิดอะไรขึ้น เช่น นักเรียนไม่ยอมอ่านใบความรู้" value={f.note} onChange={(e) => set(i, { note: e.target.value })} aria-label={`บันทึกของ${s.name}`} />
              </div>
            </li>
          )
        })}
      </ol>
      <button className="btn btn-board mt-6 w-full sm:w-auto" onClick={makeNext}>สร้างแผนสำหรับคาบถัดไป<ArrowRight size={18} aria-hidden /></button>
    </div>
  )
}
