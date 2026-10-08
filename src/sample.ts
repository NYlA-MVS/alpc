import lecturePlan from '../samples/lecture-plan.txt?raw'
import { readOldPlan } from './parse'
import type { Context } from './types'

export const SAMPLE_PLAN = lecturePlan

// A typical class: 40 students, no projector, worksheets can be printed.
export function contextFrom(text: string, base?: Partial<Context>): Context {
  const r = readOldPlan(text)
  return {
    subject: r.subject || base?.subject || '',
    grade: r.grade || base?.grade || '',
    topic: r.topic || base?.topic || '',
    indicators: r.indicators.length ? r.indicators : base?.indicators ?? [],
    minutes: r.minutes || base?.minutes || 60,
    students: base?.students ?? 40,
    resources: base?.resources ?? ['print'],
  }
}
