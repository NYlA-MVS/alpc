import { byId, LIBRARY, phaseLabel, PHASES } from './library'
import type { Activity, Context, Feedback, Issue, Phase, Plan, RubricRow, Rule, Stage } from './types'

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)
const fill = (s: string, ctx: Context) => s.replaceAll('{topic}', ctx.topic || 'หัวข้อนี้')
export const indicatorKey = (i: { code: string; text: string }) => i.code || i.text

export function allocate(minutes: number): Record<Phase, number> {
  const engage = round5(minutes * 0.13)
  const reflect = round5(minutes * 0.15)
  const practice = round5(minutes * 0.25)
  return { engage, practice, reflect, learn: Math.max(5, minutes - engage - practice - reflect) }
}

const fits = (a: Activity, ctx: Context) => a.needs.every((n) => ctx.resources.includes(n))
const distance = (a: Activity, m: number) => (m < a.min ? a.min - m : m > a.max ? m - a.max : 0)

// Activities usable for a phase in this classroom, best time-fit first, library order as tie-break.
export function candidates(phase: Phase, ctx: Context, minutes: number, exclude: string[] = []): Activity[] {
  return LIBRARY
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.phase === phase && fits(a, ctx) && !exclude.includes(a.id))
    .sort((x, y) => distance(x.a, minutes) - distance(y.a, minutes) || x.i - y.i)
    .map(({ a }) => a)
}

export function stageFrom(a: Activity, ctx: Context, minutes: number, indicators: string[]): Stage {
  return {
    phase: a.phase, activityId: a.id, name: a.name, minutes, why: a.why,
    teacher: a.teacher.map((s) => fill(s, ctx)), students: a.students.map((s) => fill(s, ctx)),
    materials: [...a.materials], check: a.check, indicators, talkShare: a.talkShare,
  }
}

function indicatorsFor(phase: Phase, ctx: Context): string[] {
  const keys = ctx.indicators.map(indicatorKey)
  if (!keys.length) return []
  return phase === 'engage' ? [keys[0]] : keys
}

function objectives(ctx: Context, stages: Stage[]) {
  const learn = stages.find((s) => s.phase === 'learn')
  const practice = stages.find((s) => s.phase === 'practice')
  return {
    k: ctx.indicators.length ? ctx.indicators.map((i) => i.text).join(' และ') + 'ได้ถูกต้อง' : `อธิบายสาระสำคัญเรื่อง${ctx.topic}ได้ถูกต้อง`,
    p: `ทำงานร่วมกับเพื่อนผ่านกิจกรรม${learn?.name ?? ''}${practice ? ` และ${practice.name}` : ''} และนำเสนอสิ่งที่ค้นพบได้`,
    a: 'มีส่วนร่วมในกิจกรรมกลุ่ม รับฟังความคิดเห็นของเพื่อน และรับผิดชอบงานที่ได้รับมอบหมาย',
  }
}

function worksheet(ctx: Context, stages: Stage[]): string[] {
  const items = stages.map((s) => byId(s.activityId)?.worksheet).filter((w): w is string => !!w).map((w) => fill(w, ctx))
  for (const i of ctx.indicators) items.push(`ตอบคำถาม: ${i.text} (ตัวชี้วัด ${indicatorKey(i)})`)
  return [...new Set(items)]
}

export function rubric(ctx: Context): RubricRow[] {
  const rows = ctx.indicators.length ? ctx.indicators : [{ code: '', text: `เข้าใจสาระสำคัญเรื่อง${ctx.topic}` }]
  return rows.map((i) => ({
    indicator: indicatorKey(i),
    levels: [
      `${i.text}ได้ถูกต้องครบถ้วน และยกตัวอย่างหรือให้เหตุผลประกอบได้ด้วยตนเอง`,
      `${i.text}ได้ถูกต้องเป็นส่วนใหญ่ มีข้อคลาดเคลื่อนเล็กน้อย`,
      `${i.text}ได้บางส่วน ต้องมีครูหรือเพื่อนช่วยแนะนำ`,
      `ยัง${i.text}ไม่ได้ หรือมีความเข้าใจคลาดเคลื่อน`,
    ],
  }))
}

// Builds a plan from the library. `variant` rotates through alternatives so a teacher can ask for another version.
export function generate(ctx: Context, variant = 0): Plan {
  const time = allocate(ctx.minutes)
  const stages = PHASES.map(({ id }) => {
    const list = candidates(id, ctx, time[id])
    const a = list[variant % Math.max(1, list.length)] ?? LIBRARY.find((x) => x.phase === id)!
    return stageFrom(a, ctx, time[id], indicatorsFor(id, ctx))
  })
  return assemble(ctx, stages, 1, 'library', [])
}

export function assemble(ctx: Context, stages: Stage[], version: number, source: Plan['source'], changes: string[]): Plan {
  return { version, source, context: ctx, stages, objectives: objectives(ctx, stages), worksheet: worksheet(ctx, stages), rubric: rubric(ctx), changes }
}

export function talkStats(plan: Pick<Plan, 'stages'>) {
  const total = plan.stages.reduce((a, s) => a + s.minutes, 0)
  const talk = Math.round(plan.stages.reduce((a, s) => a + s.minutes * s.talkShare, 0))
  return { total, talk, active: total - talk }
}

export function validate(plan: Plan): Issue[] {
  const out: Issue[] = []
  const ctx = plan.context
  const { total, talk } = talkStats(plan)
  if (total !== ctx.minutes) out.push({ level: 'error', rule: 'time', text: `เวลารวม ${total} นาที ไม่เท่ากับเวลาคาบ ${ctx.minutes} นาที` })
  const keys = ctx.indicators.map(indicatorKey)
  plan.stages.forEach((s, i) => {
    if (keys.length && !s.indicators.length) out.push({ level: 'error', rule: 'stage-indicator', text: `ขั้นที่ ${i + 1} (${s.name}) ยังไม่ได้ผูกกับตัวชี้วัด` })
    const a = byId(s.activityId)
    if (a) {
      const missing = a.needs.filter((n) => !ctx.resources.includes(n))
      if (missing.length) out.push({ level: 'error', rule: 'resources', text: `${s.name} ต้องใช้สิ่งที่ห้องนี้ไม่มี` })
      if (s.minutes < a.min) out.push({ level: 'warn', rule: 'fit', text: `${s.name} มีเวลา ${s.minutes} นาที น้อยกว่าที่กิจกรรมนี้ต้องการ (${a.min} นาที)` })
      if (a.groupSize >= 3 && ctx.students / a.groupSize > 12) out.push({ level: 'warn', rule: 'fit', text: `${s.name}: ${ctx.students} คน จะได้ ${Math.ceil(ctx.students / a.groupSize)} กลุ่ม ครูอาจดูแลไม่ทั่วถึง ลองให้กลุ่มใหญ่ขึ้น` })
    }
  })
  for (const k of keys) {
    if (!plan.stages.some((s) => s.indicators.includes(k))) out.push({ level: 'error', rule: 'coverage', text: `ตัวชี้วัด ${k} ไม่มีกิจกรรมไหนรองรับ` })
    if (!plan.rubric.some((r) => r.indicator === k)) out.push({ level: 'error', rule: 'rubric', text: `ตัวชี้วัด ${k} ไม่มีเกณฑ์ใน rubric` })
  }
  if (total && talk / total > 0.5) out.push({ level: 'warn', rule: 'talk', text: `ครูพูด ${talk} จาก ${total} นาที เกินครึ่งคาบ ยังไม่ใช่ active learning เต็มที่` })
  return out
}

// Swap one stage for the next activity of the same phase that suits this room, keeping its minutes.
export function swapStage(plan: Plan, index: number): Plan {
  const s = plan.stages[index]
  const list = candidates(s.phase, plan.context, s.minutes)
  if (list.length < 2) return plan
  const at = list.findIndex((a) => a.id === s.activityId)
  const next = list[(at + 1) % list.length]
  const stages = plan.stages.map((x, i) => (i === index ? stageFrom(next, plan.context, x.minutes, x.indicators) : x))
  return assemble(plan.context, stages, plan.version, plan.source, plan.changes)
}

// Next lesson's plan from the teacher's post-lesson notes.
export function adapt(plan: Plan, feedback: Feedback[], tried: string[] = []): Plan {
  const ctx = plan.context
  const stages = plan.stages.map((s) => ({ ...s }))
  const changes: string[] = []

  for (const f of feedback) {
    const s = stages[f.stage]
    if (!s || f.result !== 'failed') continue
    const alt = candidates(s.phase, ctx, s.minutes, [s.activityId, ...tried])[0]
    const why = f.note ? ` (บันทึกหลังสอน: “${f.note}”)` : ''
    if (alt) {
      stages[f.stage] = stageFrom(alt, ctx, s.minutes, s.indicators)
      changes.push(`${phaseLabel(s.phase)}: เปลี่ยน${s.name}เป็น${alt.name} เพราะครั้งก่อนไม่ได้ผล${why}`)
    } else {
      changes.push(`${phaseLabel(s.phase)}: ไม่มีกิจกรรมอื่นที่เหมาะกับห้องนี้ จึงคง${s.name}ไว้${why}`)
    }
  }

  for (const f of feedback.filter((x) => x.overtime)) {
    const s = stages[f.stage]
    if (!s) continue
    const donor = stages
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => i !== f.stage && d.minutes - 5 >= (byId(d.activityId)?.min ?? 5))
      .sort((a, b) => b.d.minutes - a.d.minutes)[0]
    if (donor) {
      s.minutes += 5
      donor.d.minutes -= 5
      changes.push(`เพิ่มเวลา${s.name}เป็น ${s.minutes} นาที เพราะครั้งก่อนไม่ทันเวลา และลดเวลา${donor.d.name}ลง 5 นาที`)
    } else {
      changes.push(`${s.name}ไม่ทันเวลา แต่ไม่มีขั้นไหนลดเวลาได้ ควรแบ่งเนื้อหาไปคาบถัดไป`)
    }
  }

  const worked = feedback.filter((f) => f.result === 'worked').map((f) => stages[f.stage]?.name).filter(Boolean)
  if (worked.length) changes.push(`คง${worked.join(', ')}ไว้ เพราะได้ผลดี`)
  if (!changes.length) changes.push('ไม่มีขั้นที่ต้องปรับ ใช้แผนเดิมได้')
  return assemble(ctx, stages, plan.version + 1, plan.source, changes)
}

export const RULES: { rule: Rule; label: string }[] = [
  { rule: 'time', label: 'เวลารวมพอดีกับคาบ' },
  { rule: 'stage-indicator', label: 'ทุกขั้นผูกกับตัวชี้วัด' },
  { rule: 'coverage', label: 'ทุกตัวชี้วัดมีกิจกรรมรองรับ' },
  { rule: 'rubric', label: 'ทุกตัวชี้วัดมีเกณฑ์ใน rubric' },
  { rule: 'resources', label: 'ใช้เฉพาะอุปกรณ์ที่ห้องนี้มี' },
  { rule: 'fit', label: 'เวลาและขนาดกลุ่มเหมาะกับกิจกรรม' },
  { rule: 'talk', label: 'ครูพูดไม่เกินครึ่งคาบ' },
]
