import { useState } from 'react'
import { Check, ClipboardCopy, Download, History, RefreshCw, Shuffle, Sparkles, TriangleAlert, X } from 'lucide-react'
import { candidates, RULES, swapStage, validate } from '../engine'
import { downloadWord, planText } from '../export'
import { phaseLabel } from '../library'
import { currentPlan, type Store } from '../store'
import type { Plan, Stage } from '../types'
import { PeriodBars } from './PeriodBars'
import { T } from './ui'

function StageCard({ s, index, plan, onSwap }: { s: Stage; index: number; plan: Plan; onSwap: () => void }) {
  const alternatives = s.activityId === 'ai' ? 0 : candidates(s.phase, plan.context, s.minutes).length - 1
  return (
    <li className="sheet overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-board font-[family-name:var(--font-display)] font-semibold text-chalk num">{index + 1}</span>
          <div className="min-w-0 leading-tight">
            <p className="text-[0.8125rem] text-ink-3">{phaseLabel(s.phase)} · <span className="num">{s.minutes} นาที</span></p>
            <h3 className="truncate text-[1.125rem]">{s.name}</h3>
          </div>
        </div>
        {alternatives > 0 && <button className="btn btn-quiet btn-sm" onClick={onSwap}><Shuffle size={15} aria-hidden />เปลี่ยนกิจกรรม ({alternatives} แบบ)</button>}
      </div>
      <div className="space-y-4 px-5 py-4">
        <p className="text-[0.9375rem] text-ink-2"><span className="font-semibold text-ink">ทำไมใช้กิจกรรมนี้: </span>{s.why}</p>
        {s.indicators.length > 0 && <div className="flex flex-wrap gap-1.5">{s.indicators.map((k) => <span key={k} className="chip">{k}</span>)}</div>}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold text-talk-ink"><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-talk align-middle" />ครู</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[0.9375rem] marker:text-ink-3">{s.teacher.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
          <div className="min-w-0">
            <p className="text-[0.875rem] font-semibold text-ink"><span className="mr-1.5 inline-block size-2.5 rounded-sm bg-chalk align-middle" />นักเรียน</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[0.9375rem] marker:text-ink-3">{s.students.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
        </div>
        <div className="grid gap-3 border-t border-line pt-3 text-[0.875rem] sm:grid-cols-2">
          <p className="text-ink-2"><span className="font-semibold text-ink">สื่อ: </span>{s.materials.join(', ') || '-'}</p>
          <p className="text-ink-2"><span className="font-semibold text-ink">ดูความเข้าใจระหว่างเรียน: </span>{s.check}</p>
        </div>
      </div>
    </li>
  )
}

export function PlanStep({ store, onRegenerate, onRebuild }: { store: Store; onRegenerate: () => void; onRebuild: () => void }) {
  const { state, update } = store
  const plan = currentPlan(state)
  const issues = validate(plan)
  const [tab, setTab] = useState<'objectives' | 'worksheet' | 'rubric'>('rubric')
  const [copied, setCopied] = useState(false)
  const errors = issues.filter((i) => i.level === 'error').length
  const stale = JSON.stringify(plan.context) !== JSON.stringify(state.ctx)

  const setPlan = (p: Plan) => update((s) => ({ ...s, history: s.history.map((h, i) => (i === s.current ? p : h)) }))
  const copy = async () => {
    try { await navigator.clipboard.writeText(planText(plan)); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.875rem] text-ink-3">{[plan.context.subject, plan.context.grade, `${plan.context.minutes} นาที`, `${plan.context.students} คน`].filter(Boolean).join(' · ')}</p>
          <h2 className="text-[clamp(1.5rem,3vw,2rem)] leading-snug"><T>{`แผน Active Learning|เรื่อง${plan.context.topic || 'บทเรียน'}`}</T></h2>
          <p className="mt-1 flex items-center gap-1.5 text-[0.875rem] text-ink-3">
            {plan.source === 'ai' ? <><Sparkles size={14} aria-hidden />เขียนโดย AI แล้วตรวจด้วยกติกาเดียวกัน</> : 'สร้างจากคลังกิจกรรม'} · ฉบับที่ {plan.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.source === 'library' && plan.version === 1 && <button className="btn btn-quiet btn-sm" onClick={onRegenerate}><RefreshCw size={15} aria-hidden />สร้างแบบอื่น</button>}
          <button className="btn btn-quiet btn-sm" onClick={copy}>{copied ? <Check size={15} aria-hidden /> : <ClipboardCopy size={15} aria-hidden />}{copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</button>
          <button className="btn btn-board btn-sm" onClick={() => downloadWord(plan)}><Download size={15} aria-hidden />ดาวน์โหลด Word</button>
        </div>
      </div>

      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-pen-soft px-5 py-4" role="status">
          <p className="text-pen">ข้อมูลห้องเรียนหรือแผนเดิมเปลี่ยนไปหลังสร้างแผนนี้ แผนด้านล่างยังใช้ข้อมูลเดิม</p>
          <button className="btn btn-board btn-sm" onClick={onRebuild}><RefreshCw size={15} aria-hidden />สร้างใหม่ด้วยข้อมูลล่าสุด</button>
        </div>
      )}

      {state.history.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <History size={16} className="text-ink-3" aria-hidden />
          {state.history.map((h, i) => (
            <button key={i} onClick={() => update((s) => ({ ...s, current: i }))} aria-pressed={i === state.current}
              className={`rounded-full px-3 py-1 text-[0.875rem] ${i === state.current ? 'bg-ink text-paper' : 'bg-sheet text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)]'}`}>
              ฉบับที่ {h.version}
            </button>
          ))}
        </div>
      )}

      {plan.changes.length > 0 && (
        <section className="rounded-[1rem] bg-chalk/25 p-5">
          <h3 className="text-[1.0625rem]">ปรับจากบันทึกหลังสอน</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.9375rem]">{plan.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </section>
      )}

      <PeriodBars oldPlan={state.oldPlan} plan={plan} />

      <section aria-labelledby="checks">
        <h3 id="checks" className="text-[1.25rem]">{errors ? `ยังมี ${errors} จุดที่ต้องแก้` : 'แผนนี้ผ่านการตรวจทุกข้อ'}</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RULES.map((r) => {
            const mine = issues.filter((i) => i.rule === r.rule)
            const bad = mine.some((i) => i.level === 'error')
            const warn = !bad && mine.length > 0
            return (
              <li key={r.rule} className={`rounded-xl px-4 py-3 ${bad ? 'bg-pen-soft' : warn ? 'bg-chalk/20' : 'bg-sheet'}`}>
                <p className="flex items-center gap-2 font-medium">
                  {bad ? <X size={16} className="text-pen" aria-label="ไม่ผ่าน" /> : warn ? <TriangleAlert size={16} className="text-ink-2" aria-label="ควรดู" /> : <Check size={16} className="text-ok" aria-label="ผ่าน" />}
                  {r.label}
                </p>
                {mine.map((i, k) => <p key={k} className={`mt-1 text-[0.875rem] ${i.level === 'error' ? 'text-pen' : 'text-ink-2'}`}>{i.text}</p>)}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="stages">
        <h3 id="stages" className="text-[1.25rem]">กิจกรรมการเรียนรู้</h3>
        <ol className="mt-3 space-y-4">
          {plan.stages.map((s, i) => <StageCard key={`${i}-${s.activityId}`} s={s} index={i} plan={plan} onSwap={() => setPlan(swapStage(plan, i))} />)}
        </ol>
      </section>

      <section>
        <div className="flex gap-1 border-b border-line" role="tablist">
          {([['rubric', 'Rubric'], ['worksheet', 'ใบงาน'], ['objectives', 'จุดประสงค์']] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`relative px-4 py-2.5 font-medium ${tab === id ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
              {label}
              {tab === id && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-board" />}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {tab === 'rubric' && (
            <div className="sheet overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-[0.9375rem]">
                <thead className="border-b border-line text-[0.8125rem] text-ink-3">
                  <tr><th scope="col" className="p-3 font-medium">ตัวชี้วัด</th>{['4 ดีมาก', '3 ดี', '2 พอใช้', '1 ปรับปรุง'].map((h) => <th key={h} scope="col" className="p-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {plan.rubric.map((r) => (
                    <tr key={r.indicator} className="align-top">
                      <th scope="row" className="p-3"><span className="chip">{r.indicator}</span></th>
                      {r.levels.map((l, i) => <td key={i} className="p-3 text-ink-2">{l}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'worksheet' && (
            <div className="sheet doc p-6">
              <p className="text-center font-semibold">ใบงาน เรื่อง{plan.context.topic}</p>
              <p className="mt-1 text-center text-ink-3">ชื่อ…………………………………… ชั้น……… เลขที่………</p>
              <ol className="mt-4 list-decimal space-y-3 pl-6">{plan.worksheet.map((w, i) => <li key={i}>{w}<div className="mt-1 h-10 border-b border-dashed border-line-2" /></li>)}</ol>
            </div>
          )}
          {tab === 'objectives' && (
            <dl className="sheet space-y-3 p-6">
              {([['ด้านความรู้ (K)', plan.objectives.k], ['ด้านทักษะกระบวนการ (P)', plan.objectives.p], ['ด้านคุณลักษณะ (A)', plan.objectives.a]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-[0.875rem] font-semibold text-ink-3">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </section>
    </div>
  )
}
