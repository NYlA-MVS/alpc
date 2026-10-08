import { afterEach, describe, expect, it, vi } from 'vitest'
import { listModels, writeWithAi } from './ai'
import { validate } from './engine'
import { contextFrom, mergeEdit, SAMPLE_PLAN } from './sample'

const ctx = contextFrom(SAMPLE_PLAN)
const settings = { apiKey: 'sk-test', model: 'test-model' }

function reply(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}
const planJson = (overrides: Record<string, unknown> = {}) => ({
  stages: [
    { phase: 'engage', name: 'ทายใจ', minutes: 10, why: 'w', teacher: ['t'], students: ['s'], materials: [], check: 'c', indicators: ['ว 3.1 ป.6/1'], talkShare: 0.3 },
    { phase: 'learn', name: 'สร้างแบบจำลองระบบสุริยะ', minutes: 25, why: 'w', teacher: ['t'], students: ['s'], materials: [], check: 'c', indicators: ['ว 3.1 ป.6/1', 'ว 3.1 ป.6/2'], talkShare: 0.2 },
    { phase: 'practice', name: 'เทียบขนาดดาว', minutes: 15, why: 'w', teacher: ['t'], students: ['s'], materials: [], check: 'c', indicators: ['ว 3.1 ป.6/2'], talkShare: 0.2 },
    { phase: 'reflect', name: 'บัตรออก', minutes: 10, why: 'w', teacher: ['t'], students: ['s'], materials: [], check: 'c', indicators: ['ว 3.1 ป.6/1'], talkShare: 1.7 },
  ],
  objectives: { k: 'k', p: 'p', a: 'a' },
  worksheet: ['ข้อ 1'],
  rubric: [{ indicator: 'ว 3.1 ป.6/1', levels: ['4', '3', '2', '1'] }, { indicator: 'ว 3.1 ป.6/2', levels: ['4', '3', '2', '1'] }],
  ...overrides,
})
const chat = (content: string | null, refusal: string | null = null) => ({ choices: [{ message: { content, refusal } }] })

afterEach(() => vi.unstubAllGlobals())

describe('AI writer', () => {
  it('sends a strict JSON schema request and turns the reply into a valid plan', async () => {
    const fetch = reply(200, chat(JSON.stringify(planJson())))
    vi.stubGlobal('fetch', fetch)
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, settings)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(body.model).toBe('test-model')
    expect(body.response_format.json_schema.strict).toBe(true)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(plan.source).toBe('ai')
    expect(plan.stages.every((s) => s.activityId === 'ai')).toBe(true)
    expect(plan.stages[3].talkShare).toBe(1) // clamped
    expect(validate(plan).filter((i) => i.level === 'error')).toEqual([])
  })

  it('lets the validator catch an AI plan that breaks the rules', async () => {
    const bad = planJson({ rubric: [] })
    ;(bad.stages as { minutes: number }[])[1].minutes = 40
    vi.stubGlobal('fetch', reply(200, chat(JSON.stringify(bad))))
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, settings)
    const errors = validate(plan).filter((i) => i.level === 'error').map((i) => i.rule)
    expect(errors).toContain('time')
    expect(plan.rubric).toHaveLength(2) // missing rubric falls back to one row per indicator
  })

  it('explains failures in Thai', async () => {
    vi.stubGlobal('fetch', reply(401, { error: { message: 'Incorrect API key' } }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, settings)).rejects.toThrow('API key ไม่ถูกต้อง')
    vi.stubGlobal('fetch', reply(429, { error: { message: 'quota' } }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, settings)).rejects.toThrow('ขีดจำกัด')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, settings)).rejects.toThrow('เชื่อมต่อ OpenAI ไม่ได้')
    vi.stubGlobal('fetch', reply(200, chat('{not json')))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, settings)).rejects.toThrow('อ่านไม่ได้')
    vi.stubGlobal('fetch', reply(200, chat(null, 'cannot help')))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, settings)).rejects.toThrow('ปฏิเสธ')
  })

  it('refuses to call without a key or model', async () => {
    await expect(writeWithAi(ctx, SAMPLE_PLAN, { apiKey: '', model: 'm' })).rejects.toThrow('API key')
    await expect(writeWithAi(ctx, SAMPLE_PLAN, { apiKey: 'k', model: '' })).rejects.toThrow('โมเดล')
  })

  it('lists only models that can write the plan', async () => {
    vi.stubGlobal('fetch', reply(200, { data: ['gpt-test', 'gpt-test-audio-preview', 'gpt-image-x', 'o9-mini', 'text-embedding-x', 'gpt-test-realtime', 'dall-e-3'].map((id) => ({ id })) }))
    expect(await listModels('sk')).toEqual(['gpt-test', 'o9-mini'])
  })
})

describe('reading the plan while the teacher edits', () => {
  it('keeps what the teacher typed when the edited text no longer says it', () => {
    const typed = { ...ctx, topic: 'ระบบสุริยะ (ทบทวน)', indicators: [{ code: 'ว 9.9 ป.6/9', text: 'เพิ่มเอง' }], minutes: 50 }
    const next = contextFrom('ข้อความที่ไม่มีหัวข้อ ไม่มีตัวชี้วัด และไม่มีเวลา', typed)
    expect(next.topic).toBe('ระบบสุริยะ (ทบทวน)')
    expect(next.indicators).toEqual(typed.indicators)
    expect(next.minutes).toBe(50)
  })

  it('takes new values when the text states them', () => {
    const next = contextFrom('เรื่อง แรงและการเคลื่อนที่  เวลา 2 ชั่วโมง', { ...ctx })
    expect(next.topic).toBe('แรงและการเคลื่อนที่')
    expect(next.minutes).toBe(120)
  })
})

describe('editing the old plan text', () => {
  const base = contextFrom(SAMPLE_PLAN)
  const manual = { code: 'ว 9.9 ป.6/9', text: 'เพิ่มเอง' }
  const typed = { ...base, minutes: 45, topic: 'หัวข้อที่ครูแก้', indicators: [...base.indicators, manual] }

  it('keeps form edits and hand-added indicators when an unrelated part of the text changes', () => {
    const next = mergeEdit(SAMPLE_PLAN, SAMPLE_PLAN + '\nหมายเหตุ ทดสอบ', typed)
    expect(next.minutes).toBe(45)
    expect(next.topic).toBe('หัวข้อที่ครูแก้')
    expect(next.indicators).toEqual(typed.indicators)
  })

  it('takes the new value when that part of the text is edited', () => {
    const next = mergeEdit(SAMPLE_PLAN, SAMPLE_PLAN.replace('เวลา 1 ชั่วโมง', 'เวลา 2 ชั่วโมง').replace('ว 3.1 ป.6/2 ', 'ว 3.1 ป.6/3 '), typed)
    expect(next.minutes).toBe(120)
    expect(next.indicators.map((i) => i.code)).toEqual(['ว 3.1 ป.6/1', 'ว 3.1 ป.6/3', 'ว 9.9 ป.6/9'])
  })
})
