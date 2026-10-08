import { describe, expect, it } from 'vitest'
import { adapt, allocate, generate, swapStage, talkStats, validate } from './engine'
import { byId } from './library'
import { readOldPlan } from './parse'
import { contextFrom, SAMPLE_PLAN } from './sample'

describe('reading an old plan', () => {
  const r = readOldPlan(SAMPLE_PLAN)

  it('finds topic, subject, grade, time and indicators', () => {
    expect(r.topic).toBe('ดาวเคราะห์ในระบบสุริยะ')
    expect(r.subject).toBe('วิทยาศาสตร์และเทคโนโลยี')
    expect(r.grade).toBe('ป.6')
    expect(r.minutes).toBe(60)
    expect(r.indicators.map((i) => i.code)).toEqual(['ว 3.1 ป.6/1', 'ว 3.1 ป.6/2'])
  })

  it('shares stage minutes to steps without their own and spots teacher talk', () => {
    expect(r.steps).toHaveLength(5)
    expect(r.steps[0]).toMatchObject({ minutes: 5, teacherTalk: true })
    expect(r.steps[4]).toMatchObject({ minutes: 10, teacherTalk: false })
    expect(r.talkMinutes).toBe(50)
  })

  it('reads hours and minutes, and falls back to 60', () => {
    expect(readOldPlan('เรื่อง ก  เวลา 2 ชั่วโมง').minutes).toBe(120)
    expect(readOldPlan('เรื่อง ก  เวลา 50 นาที').minutes).toBe(50)
    expect(readOldPlan('ไม่มีอะไรเลย').minutes).toBe(60)
  })
})

describe('generating a plan', () => {
  const ctx = contextFrom(SAMPLE_PLAN)

  it('splits the period into four stages that add up exactly', () => {
    for (const m of [40, 50, 55, 60, 90, 120]) {
      const a = allocate(m)
      expect(a.engage + a.learn + a.practice + a.reflect).toBe(m)
    }
  })

  it('passes its own validator on the sample and cuts teacher talk', () => {
    const plan = generate(ctx)
    expect(validate(plan).filter((i) => i.level === 'error')).toEqual([])
    expect(talkStats(plan).talk).toBeLessThan(readOldPlan(SAMPLE_PLAN).talkMinutes)
    expect(plan.rubric.map((r) => r.indicator)).toEqual(['ว 3.1 ป.6/1', 'ว 3.1 ป.6/2'])
  })

  it('never picks an activity the room cannot run', () => {
    const bare = { ...ctx, resources: [] }
    for (let v = 0; v < 6; v++) {
      for (const s of generate(bare, v).stages) expect(byId(s.activityId)!.needs).toEqual([])
    }
  })

  it('swaps a stage for another activity of the same stage', () => {
    const plan = generate(ctx)
    const next = swapStage(plan, 1)
    expect(next.stages[1].activityId).not.toBe(plan.stages[1].activityId)
    expect(next.stages[1].phase).toBe('learn')
    expect(next.stages[1].minutes).toBe(plan.stages[1].minutes)
  })

  it('flags a plan whose time does not add up or misses an indicator', () => {
    const plan = generate(ctx)
    const broken = { ...plan, stages: plan.stages.map((s, i) => (i === 0 ? { ...s, minutes: s.minutes + 5, indicators: [] } : { ...s, indicators: s.indicators.filter((k) => k !== 'ว 3.1 ป.6/2') })) }
    const texts = validate(broken).map((i) => i.text).join('\n')
    expect(texts).toContain('เวลารวม 65 นาที')
    expect(texts).toContain('ขั้นที่ 1')
    expect(texts).toContain('ว 3.1 ป.6/2 ไม่มีกิจกรรมไหนรองรับ')
  })
})

describe('adapting from post-lesson notes', () => {
  const ctx = contextFrom(SAMPLE_PLAN)
  const plan = generate(ctx)

  it('replaces failed activities, keeps what worked, and keeps the total time', () => {
    const next = adapt(plan, [
      { stage: 0, result: 'worked', overtime: false, note: '' },
      { stage: 1, result: 'failed', overtime: false, note: 'เด็กไม่ยอมอ่านใบความรู้' },
      { stage: 2, result: 'ok', overtime: true, note: '' },
    ])
    expect(next.version).toBe(2)
    expect(next.stages[0].activityId).toBe(plan.stages[0].activityId)
    expect(next.stages[1].activityId).not.toBe(plan.stages[1].activityId)
    expect(next.stages[2].minutes).toBe(plan.stages[2].minutes + 5)
    expect(talkStats(next).total).toBe(ctx.minutes)
    expect(next.changes.join('\n')).toContain('เด็กไม่ยอมอ่านใบความรู้')
  })
})

describe('group size warning', () => {
  it('does not warn about pair work in a big class, but does for many small groups', () => {
    const ctx = { ...contextFrom(SAMPLE_PLAN), students: 60 }
    const plan = generate(ctx)
    const fit = validate(plan).filter((i) => i.rule === 'fit').map((i) => i.text).join('\n')
    expect(fit).not.toContain('คิด-คู่-แชร์')
    expect(fit).toContain('จิ๊กซอว์')
  })
})
