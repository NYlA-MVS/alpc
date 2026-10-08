import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiReady, EMPTY_AI, listModels, loadAi, writeWithAi, type AiSettings } from './ai'
import { validate } from './engine'
import { contextFrom, mergeEdit, SAMPLE_PLAN } from './sample'

const ctx = contextFrom(SAMPLE_PLAN)
const with_ = (provider: AiSettings['provider'], extra: Partial<AiSettings> = {}): AiSettings =>
  ({ ...EMPTY_AI, provider, keys: { [provider]: 'k-test' }, models: { [provider]: 'test-model' }, ...extra })

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function reply(status: number, body: unknown) { return vi.fn(async () => json(status, body)) }
const call = (f: ReturnType<typeof vi.fn>, i = 0) => {
  const [url, init] = f.mock.calls[i] as unknown as [string | URL | Request, RequestInit | undefined]
  const u = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
  const headers = new Headers(init?.headers ?? (url instanceof Request ? url.headers : undefined))
  return { url: u, headers, body: init?.body ? JSON.parse(init.body as string) : undefined }
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
const claudeMsg = (text: string, stop_reason = 'end_turn', extra: Record<string, unknown> = {}) => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'test-model', content: [{ type: 'text', text }], stop_reason, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, ...extra,
})
const noErrors = (p: Awaited<ReturnType<typeof writeWithAi>>) => expect(validate(p).filter((i) => i.level === 'error')).toEqual([])

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI', () => {
  it('sends a strict JSON schema request and turns the reply into a valid plan', async () => {
    const f = reply(200, chat(JSON.stringify(planJson())))
    vi.stubGlobal('fetch', f)
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, with_('openai'))
    const c = call(f)
    expect(c.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(c.headers.get('authorization')).toBe('Bearer k-test')
    expect(c.body.response_format.json_schema.strict).toBe(true)
    expect(plan.source).toBe('ai')
    expect(plan.stages[3].talkShare).toBe(1)
    noErrors(plan)
  })

  it('lets the validator catch a plan that breaks the rules, and fills a missing rubric', async () => {
    const bad = planJson({ rubric: [] })
    ;(bad.stages as { minutes: number }[])[1].minutes = 40
    vi.stubGlobal('fetch', reply(200, chat(JSON.stringify(bad))))
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, with_('openai'))
    expect(validate(plan).filter((i) => i.level === 'error').map((i) => i.rule)).toContain('time')
    expect(plan.rubric).toHaveLength(2)
  })

  it('explains failures in Thai', async () => {
    const s = with_('openai')
    vi.stubGlobal('fetch', reply(401, { error: { message: 'Incorrect API key' } }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, s)).rejects.toThrow('API key ไม่ถูกต้อง')
    vi.stubGlobal('fetch', reply(429, { error: { message: 'quota' } }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, s)).rejects.toThrow('ขีดจำกัด')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, s)).rejects.toThrow('เชื่อมต่อผู้ให้บริการไม่ได้')
    vi.stubGlobal('fetch', reply(200, chat('{not json')))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, s)).rejects.toThrow('อ่านไม่ได้')
    vi.stubGlobal('fetch', reply(200, chat(null, 'cannot help')))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, s)).rejects.toThrow('ปฏิเสธ')
  })

  it('lists only models that can write the plan', async () => {
    vi.stubGlobal('fetch', reply(200, { data: ['gpt-test', 'gpt-test-audio-preview', 'gpt-image-x', 'o9-mini', 'text-embedding-x', 'gpt-test-realtime', 'dall-e-3'].map((id) => ({ id })) }))
    expect((await listModels(with_('openai'))).models).toEqual(['gpt-test', 'o9-mini'])
  })
})

describe('Claude', () => {
  it('calls the Messages API from the browser with a JSON schema format', async () => {
    const f = vi.fn(async () => json(200, claudeMsg(JSON.stringify(planJson()))))
    vi.stubGlobal('fetch', f)
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic'))
    const c = call(f)
    expect(c.url).toBe('https://api.anthropic.com/v1/messages')
    expect(c.headers.get('x-api-key')).toBe('k-test')
    expect(c.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true')
    expect(c.body.output_config.format.type).toBe('json_schema')
    expect(c.body.max_tokens).toBe(16000)
    noErrors(plan)
  })

  it('turns on refusal fallbacks and effort only for models that support them', async () => {
    const f = vi.fn(async () => json(200, claudeMsg(JSON.stringify(planJson()))))
    vi.stubGlobal('fetch', f)
    await writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic', { models: { anthropic: 'claude-opus-5-5' } }))
    const opus = call(f, 0)
    expect(opus.body.fallbacks).toBe('default')
    expect(opus.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(opus.body.output_config.effort).toBe('medium')
    await writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic', { models: { anthropic: 'claude-haiku-4-5' } }))
    const haiku = call(f, 1)
    expect(haiku.body.fallbacks).toBeUndefined()
    expect(haiku.body.output_config.effort).toBeUndefined()
  })

  it('reads the text even when a fallback block comes first', async () => {
    const body = claudeMsg('', 'end_turn', {
      content: [{ type: 'fallback', from: { model: 'a' }, to: { model: 'b' } }, { type: 'text', text: JSON.stringify(planJson()) }],
    })
    vi.stubGlobal('fetch', vi.fn(async () => json(200, body)))
    noErrors(await writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic', { models: { anthropic: 'claude-opus-5-5' } })))
  })

  it('explains refusals, truncation and bad keys in Thai', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, claudeMsg('', 'refusal', { content: [], stop_details: { type: 'refusal', category: 'cyber', explanation: null } }))))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic'))).rejects.toThrow('Claude ปฏิเสธคำขอนี้ (cyber)')
    vi.stubGlobal('fetch', vi.fn(async () => json(200, claudeMsg('{"stages": [', 'max_tokens'))))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic'))).rejects.toThrow('ยาวเกิน')
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, with_('anthropic'))).rejects.toThrow('Claude API key ไม่ถูกต้อง')
  })

  it('lists models and suggests the default Claude model', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { data: [{ id: 'claude-opus-5-5', type: 'model' }, { id: 'claude-haiku-4-5', type: 'model' }], has_more: false, first_id: 'a', last_id: 'b' })))
    expect(await listModels(with_('anthropic'))).toEqual({ models: ['claude-opus-5-5', 'claude-haiku-4-5'], suggested: 'claude-opus-5-5' })
  })
})

describe('Gemini', () => {
  it('asks for JSON with the schema in the prompt and reads the candidate text', async () => {
    const f = reply(200, { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(planJson()) + '\n```' }] } }] })
    vi.stubGlobal('fetch', f)
    const plan = await writeWithAi(ctx, SAMPLE_PLAN, with_('gemini'))
    const c = call(f)
    expect(c.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent?key=k-test')
    expect(c.body.generationConfig.responseMimeType).toBe('application/json')
    expect(c.body.contents[0].parts[0].text).toContain('JSON Schema')
    noErrors(plan)
  })

  it('reports a blocked prompt and lists generateContent models only', async () => {
    vi.stubGlobal('fetch', reply(200, { promptFeedback: { blockReason: 'SAFETY' } }))
    await expect(writeWithAi(ctx, SAMPLE_PLAN, with_('gemini'))).rejects.toThrow('Gemini ปฏิเสธคำขอนี้ (SAFETY)')
    vi.stubGlobal('fetch', reply(200, { models: [
      { name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding-x', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-test-image', supportedGenerationMethods: ['generateContent'] },
    ] }))
    expect((await listModels(with_('gemini'))).models).toEqual(['gemini-test'])
  })
})

describe('OpenAI-compatible services', () => {
  it('uses the base URL, works without a key, and retries without response_format when it is rejected', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(400, { error: { message: 'response_format not supported' } }))
      .mockResolvedValueOnce(json(200, chat(JSON.stringify(planJson()))))
    vi.stubGlobal('fetch', f)
    const s = { ...EMPTY_AI, provider: 'compatible' as const, baseUrl: 'http://localhost:11434/v1/', models: { compatible: 'llama-test' } }
    expect(aiReady(s)).toBe(true)
    noErrors(await writeWithAi(ctx, SAMPLE_PLAN, s))
    expect(call(f, 0).url).toBe('http://localhost:11434/v1/chat/completions')
    expect(call(f, 0).headers.get('authorization')).toBeNull()
    expect(call(f, 0).body.response_format).toEqual({ type: 'json_object' })
    expect(call(f, 1).body.response_format).toBeUndefined()
  })
})

describe('settings', () => {
  it('refuses to call without what each provider needs', async () => {
    await expect(writeWithAi(ctx, SAMPLE_PLAN, { ...with_('openai'), keys: {} })).rejects.toThrow('API key')
    await expect(writeWithAi(ctx, SAMPLE_PLAN, { ...with_('anthropic'), models: {} })).rejects.toThrow('โมเดล')
    await expect(writeWithAi(ctx, SAMPLE_PLAN, with_('compatible'))).rejects.toThrow('Base URL')
  })

  it('moves settings saved by the OpenAI-only version into the new format', () => {
    const store = new Map<string, string>([['alpc:openai', JSON.stringify({ apiKey: 'sk-old', model: 'gpt-old' })]])
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
    expect(loadAi()).toEqual({ ...EMPTY_AI, keys: { openai: 'sk-old' }, models: { openai: 'gpt-old' } })
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
