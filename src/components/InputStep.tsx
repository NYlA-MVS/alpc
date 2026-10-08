import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FileUp, Plus, RotateCcw, Sparkles, Trash2, Wand2 } from 'lucide-react'
import type { AiSettings } from '../ai'
import { RESOURCES } from '../library'
import { readOldPlan } from '../parse'
import { contextFrom, mergeEdit, SAMPLE_PLAN } from '../sample'
import type { Store } from '../store'
import type { Context } from '../types'
import { Field } from './ui'

// Lets the teacher type freely; the value is clamped only when they leave the field.
function NumberInput({ id, value, min, max, fallback, onCommit }: { id: string; value: number; min: number; max: number; fallback: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = Math.round(Number(draft))
    const next = Number.isFinite(n) && draft.trim() !== '' ? Math.max(min, Math.min(max, n)) : fallback
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }
  return <input id={id} inputMode="numeric" className="field num" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
}

export function InputStep({ store, ai, onConvert, busy, error }: {
  store: Store; ai: AiSettings; busy: boolean; error: string
  onConvert: (mode: 'library' | 'ai') => void
}) {
  const { state, update } = store
  const ctx = state.ctx
  const reading = useMemo(() => readOldPlan(state.oldPlan), [state.oldPlan])
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const setCtx = (patch: Partial<Context>) => update((s) => ({ ...s, ctx: { ...s.ctx, ...patch } }))

  // A new plan (sample or file) replaces what was read before; editing the text keeps what the teacher typed
  // in the form unless the text now says something else.
  const loadPlan = (t: string) => update((s) => ({ ...s, oldPlan: t, ctx: contextFrom(t, { students: s.ctx.students, resources: s.ctx.resources }) }))
  const editPlan = (t: string) => update((s) => ({ ...s, oldPlan: t, ctx: mergeEdit(s.oldPlan, t, s.ctx) }))
  const addIndicator = () => {
    if (!text.trim()) return
    setCtx({ indicators: [...ctx.indicators, { code: code.trim(), text: text.trim() }] })
    setCode(''); setText('')
  }
  const aiReady = !!ai.apiKey && !!ai.model

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[1.375rem]">แผนการสอนเดิม</h2>
            <p className="text-[0.9375rem] text-ink-3">วางแผนแบบบรรยายที่มีอยู่ ระบบจะอ่านหัวข้อ ตัวชี้วัด เวลา และขั้นตอนเอง</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-quiet btn-sm" onClick={() => loadPlan(SAMPLE_PLAN)}><RotateCcw size={15} aria-hidden />ตัวอย่าง</button>
            <label className="btn btn-quiet btn-sm cursor-pointer">
              <FileUp size={15} aria-hidden />เปิดไฟล์ .txt
              <input id="plan-file" type="file" accept=".txt,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) loadPlan(await f.text()); e.target.value = '' }} />
            </label>
          </div>
        </div>
        <div className="sheet mt-4 p-1.5">
          <textarea
            id="old-plan" aria-label="แผนการสอนเดิม"
            className="doc block h-[26rem] w-full resize-y rounded-[0.8rem] bg-transparent px-5 py-4 focus:outline-none focus:ring-2 focus:ring-board"
            value={state.oldPlan} onChange={(e) => editPlan(e.target.value)}
            placeholder="วางแผนการจัดการเรียนรู้เดิมที่นี่ เช่น เรื่อง… เวลา 1 ชั่วโมง, ตัวชี้วัด, ขั้นนำ (5 นาที) 1. ครู…"
          />
        </div>
        {reading.steps.length > 0 && (
          <div className="mt-5">
            <p className="text-[0.875rem] font-medium text-ink-2">ระบบอ่านขั้นตอนเดิมได้ {reading.steps.length} ขั้น · ครูพูด {reading.talkMinutes} นาที</p>
            <ol className="mt-2 space-y-1.5">
              {reading.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[0.9375rem]">
                  <span className={`mt-0.5 shrink-0 rounded-md px-2 text-[0.75rem] font-semibold leading-6 ${s.teacherTalk ? 'bg-talk text-talk-ink' : 'bg-chalk text-[#1b201d]'}`}>{s.teacherTalk ? 'ครูพูด' : 'นักเรียนทำ'}</span>
                  <span className="min-w-0 flex-1 text-ink-2">{s.text}</span>
                  <span className="num shrink-0 text-ink-3">{s.minutes}′</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="min-w-0">
        <h2 className="text-[1.375rem]">ห้องเรียนนี้</h2>
        <p className="text-[0.9375rem] text-ink-3">ตรวจสิ่งที่ระบบอ่านได้ และบอกสิ่งที่ห้องเรียนมีจริง</p>
        <div className="sheet mt-4 space-y-4 p-5">
          <Field label="เรื่อง" htmlFor="topic"><input id="topic" className="field" value={ctx.topic} onChange={(e) => setCtx({ topic: e.target.value })} placeholder="เช่น ดาวเคราะห์ในระบบสุริยะ" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="กลุ่มสาระ / วิชา" htmlFor="subject"><input id="subject" className="field" value={ctx.subject} onChange={(e) => setCtx({ subject: e.target.value })} /></Field>
            <Field label="ชั้น" htmlFor="grade"><input id="grade" className="field" value={ctx.grade} onChange={(e) => setCtx({ grade: e.target.value })} placeholder="เช่น ป.6" /></Field>
            <Field label="เวลาคาบ (นาที)" htmlFor="minutes" hint="20–180 นาที"><NumberInput id="minutes" value={ctx.minutes} min={20} max={180} fallback={60} onCommit={(minutes) => setCtx({ minutes })} /></Field>
            <Field label="จำนวนนักเรียน" htmlFor="students" hint="1–80 คน"><NumberInput id="students" value={ctx.students} min={1} max={80} fallback={30} onCommit={(students) => setCtx({ students })} /></Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[0.875rem] font-medium text-ink-2">ห้องนี้มี</legend>
            <div className="flex flex-wrap gap-2">
              {RESOURCES.map((r) => {
                const on = ctx.resources.includes(r.id)
                return (
                  <button
                    key={r.id} type="button" aria-pressed={on}
                    onClick={() => setCtx({ resources: on ? ctx.resources.filter((x) => x !== r.id) : [...ctx.resources, r.id] })}
                    className={`rounded-full px-3.5 py-1.5 text-[0.875rem] transition-colors ${on ? 'bg-board text-on-board' : 'bg-paper text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-ink'}`}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[0.8125rem] text-ink-3">ไม่มีอะไรเลยก็ได้ คลังกิจกรรมส่วนใหญ่ใช้แค่กระดาษกับกระดาน</p>
          </fieldset>

          <div>
            <p className="mb-1.5 text-[0.875rem] font-medium text-ink-2">ตัวชี้วัด</p>
            <ul className="space-y-2">
              {ctx.indicators.map((ind, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2">
                  {ind.code && <span className="chip shrink-0">{ind.code}</span>}
                  <span className="min-w-0 flex-1 text-[0.9375rem]">{ind.text}</span>
                  <button className="text-ink-3 hover:text-pen" onClick={() => setCtx({ indicators: ctx.indicators.filter((_, j) => j !== i) })} aria-label={`ลบตัวชี้วัด ${ind.code || ind.text}`}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); addIndicator() }}>
              <input id="ind-code" className="field w-[10.5rem]" placeholder="รหัส เช่น ว 3.1 ป.6/1" value={code} onChange={(e) => setCode(e.target.value)} aria-label="รหัสตัวชี้วัด" />
              <input id="ind-text" className="field min-w-[10rem] flex-1" placeholder="ข้อความตัวชี้วัด" value={text} onChange={(e) => setText(e.target.value)} aria-label="ข้อความตัวชี้วัด" />
              <button className="btn btn-quiet btn-sm" disabled={!text.trim()}><Plus size={15} aria-hidden />เพิ่ม</button>
            </form>
            {state.oldPlan === SAMPLE_PLAN && <p className="mt-1.5 text-[0.8125rem] text-ink-3">แผนตัวอย่างและรหัสตัวชี้วัดเป็นข้อมูลสมมติ ตรวจรหัสกับหลักสูตรสถานศึกษาก่อนใช้จริง</p>}
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <button className="btn btn-board w-full" onClick={() => onConvert('library')} disabled={busy}>
            <Wand2 size={18} aria-hidden />แปลงเป็นแผน Active Learning<ArrowRight size={18} aria-hidden />
          </button>
          <button className="btn btn-quiet w-full" onClick={() => onConvert('ai')} disabled={busy || !aiReady} title={aiReady ? undefined : 'ใส่ OpenAI API key และเลือกโมเดลที่ปุ่ม AI ด้านบนก่อน'}>
            <Sparkles size={17} aria-hidden />{busy ? 'AI กำลังเขียนแผน…' : 'ให้ AI เขียนแผนเต็ม'}
          </button>
          {!aiReady && <p className="text-center text-[0.8125rem] text-ink-3">AI เป็นตัวเลือกเสริม ใส่ OpenAI API key ของคุณที่ปุ่ม “AI” มุมขวาบน</p>}
          {error && <p className="rounded-lg bg-pen-soft px-3 py-2 text-[0.9375rem] text-pen" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  )
}
