import lecturePlan from '../samples/lecture-plan.txt?raw'
import { readOldPlan } from './parse'
import type { Context, Indicator } from './types'

export const SAMPLE_PLAN = lecturePlan

// A typical class: 40 students, no projector, worksheets can be printed.
export function contextFrom(text: string, base: Partial<Context> = {}): Context {
  const r = readOldPlan(text)
  return {
    subject: r.subject || base.subject || '',
    grade: r.grade || base.grade || '',
    topic: r.topic || base.topic || '',
    indicators: r.indicators.length ? r.indicators : base.indicators ?? [],
    minutes: r.foundMinutes ? r.minutes : base.minutes || r.minutes,
    students: base.students ?? 40,
    resources: base.resources ?? ['print'],
  }
}

const sameIndicator = (a: Indicator, b: Indicator) => (a.code && a.code === b.code) || a.text === b.text

// While the teacher edits the old plan, a value read from the text replaces the form only when that part
// of the text actually changed. Anything the teacher set in the form otherwise stays, and indicators they
// added by hand are kept alongside the ones read from the text.
export function mergeEdit(prevText: string, nextText: string, ctx: Context): Context {
  const prev = readOldPlan(prevText)
  const next = readOldPlan(nextText)
  const pick = <T,>(a: T, b: T, current: T) => (JSON.stringify(a) === JSON.stringify(b) ? current : b || current)
  const manual = ctx.indicators.filter((i) => !prev.indicators.some((p) => sameIndicator(p, i)))
  const fromText = JSON.stringify(prev.indicators) === JSON.stringify(next.indicators)
    ? ctx.indicators.filter((i) => !manual.includes(i))
    : next.indicators
  return {
    ...ctx,
    topic: pick(prev.topic, next.topic, ctx.topic),
    subject: pick(prev.subject, next.subject, ctx.subject),
    grade: pick(prev.grade, next.grade, ctx.grade),
    minutes: next.foundMinutes && next.minutes !== prev.minutes ? next.minutes : ctx.minutes,
    indicators: [...fromText, ...manual.filter((m) => !fromText.some((f) => sameIndicator(f, m)))],
  }
}
