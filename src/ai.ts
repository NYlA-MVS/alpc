import { assemble, indicatorKey, rubric as defaultRubric } from './engine'
import { LIBRARY, PHASES, RESOURCES } from './library'
import { DEFAULT_CLAUDE_MODEL, listClaudeModels, writeClaude } from './providers/anthropic'
import { listGeminiModels, writeGemini } from './providers/gemini'
import { listOpenAiModels, OPENAI_URL, writeCompatible, writeOpenAiStrict } from './providers/openai'
import type { Context, Phase, Plan, RubricRow, Stage } from './types'

// Optional AI writer. Every provider is called straight from the teacher's browser with the teacher's own key;
// keys stay on this device except for the request to the chosen provider.

export type ProviderId = 'openai' | 'anthropic' | 'gemini' | 'compatible'

export const PROVIDERS: { id: ProviderId; label: string; keyLabel: string; keyPlaceholder: string; keyUrl?: string; note: string }[] = [
  { id: 'openai', label: 'OpenAI', keyLabel: 'OpenAI API key', keyPlaceholder: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys', note: 'ตอบเป็น JSON ตาม schema แบบเข้มงวด' },
  { id: 'anthropic', label: 'Claude (Anthropic)', keyLabel: 'Claude API key', keyPlaceholder: 'sk-ant-…', keyUrl: 'https://platform.claude.com/settings/keys', note: 'ตอบเป็น JSON ตาม schema แบบเข้มงวด' },
  { id: 'gemini', label: 'Google Gemini', keyLabel: 'Gemini API key', keyPlaceholder: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey', note: 'ตอบเป็น JSON แล้วแอปตรวจโครงสร้างให้' },
  { id: 'compatible', label: 'อื่น ๆ ที่ใช้รูปแบบ OpenAI', keyLabel: 'API key (Ollama ไม่ต้องใส่)', keyPlaceholder: 'key ของผู้ให้บริการ', note: 'เช่น Typhoon, OpenRouter, Groq หรือ Ollama ในเครื่อง' },
]

export const COMPATIBLE_PRESETS: { label: string; url: string }[] = [
  { label: 'Typhoon (LLM ภาษาไทย)', url: 'https://api.opentyphoon.ai/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Ollama ในเครื่อง', url: 'http://localhost:11434/v1' },
]

export interface AiSettings {
  provider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  models: Partial<Record<ProviderId, string>>
  baseUrl: string // for 'compatible'
}

const KEY = 'alpc:ai:v2'
const OLD_KEY = 'alpc:openai'
export const EMPTY_AI: AiSettings = { provider: 'openai', keys: {}, models: {}, baseUrl: '' }

export function loadAi(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY_AI, ...(JSON.parse(raw) as AiSettings) }
    const old = localStorage.getItem(OLD_KEY) // settings saved before more providers were added
    if (old) {
      const o = JSON.parse(old) as { apiKey?: string; model?: string }
      return { ...EMPTY_AI, keys: { openai: o.apiKey ?? '' }, models: { openai: o.model ?? '' } }
    }
  } catch { /* storage unavailable or corrupt */ }
  return EMPTY_AI
}
export function saveAi(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    localStorage.removeItem(OLD_KEY)
  } catch { /* storage unavailable */ }
}

export const keyOf = (s: AiSettings, p: ProviderId = s.provider) => (s.keys[p] ?? '').trim()
export const modelOf = (s: AiSettings, p: ProviderId = s.provider) => s.models[p] ?? ''
export const providerLabel = (p: ProviderId) => PROVIDERS.find((x) => x.id === p)!.label
// A short name for buttons: the provider, or the host of a compatible service (e.g. api.opentyphoon.ai).
export function aiName(s: AiSettings): string {
  if (s.provider !== 'compatible') return providerLabel(s.provider).replace(/ \(.*\)$/, '')
  try { return new URL(s.baseUrl).host || 'บริการที่ตั้งไว้' } catch { return 'บริการที่ตั้งไว้' }
}
export function aiReady(s: AiSettings): boolean {
  if (!modelOf(s)) return false
  if (s.provider === 'compatible') return !!s.baseUrl.trim()
  return !!keyOf(s)
}

// Model names change often, so lists come from the teacher's own account.
export async function listModels(s: AiSettings): Promise<{ models: string[]; suggested?: string }> {
  const key = keyOf(s)
  switch (s.provider) {
    case 'openai': return { models: await listOpenAiModels(OPENAI_URL, key, true) }
    case 'anthropic': {
      const models = await listClaudeModels(key)
      return { models, suggested: models.includes(DEFAULT_CLAUDE_MODEL) ? DEFAULT_CLAUDE_MODEL : undefined }
    }
    case 'gemini': return { models: await listGeminiModels(key) }
    case 'compatible': return { models: await listOpenAiModels(s.baseUrl, key, false) }
  }
}

const PHASE_IDS = PHASES.map((p) => p.id)
const str = { type: 'string' }
const strs = { type: 'array', items: str }

export const PLAN_SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false,
  required: ['stages', 'objectives', 'worksheet', 'rubric'],
  properties: {
    stages: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['phase', 'name', 'minutes', 'why', 'teacher', 'students', 'materials', 'check', 'indicators', 'talkShare'],
        properties: {
          phase: { type: 'string', enum: PHASE_IDS }, name: str, minutes: { type: 'integer' }, why: str,
          teacher: strs, students: strs, materials: strs, check: str, indicators: strs, talkShare: { type: 'number' },
        },
      },
    },
    objectives: { type: 'object', additionalProperties: false, required: ['k', 'p', 'a'], properties: { k: str, p: str, a: str } },
    worksheet: strs,
    rubric: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['indicator', 'levels'],
        properties: { indicator: str, levels: { type: 'array', items: str } },
      },
    },
  },
}

const SYSTEM = 'คุณเป็นศึกษานิเทศก์ที่เชี่ยวชาญการออกแบบการเรียนรู้เชิงรุกในโรงเรียนไทย ตอบเป็น JSON object เพียงก้อนเดียวตาม schema ที่กำหนด ไม่มีข้อความอื่น'

export function buildPrompt(ctx: Context, oldPlan: string, includeSchema: boolean) {
  const have = RESOURCES.filter((r) => ctx.resources.includes(r.id)).map((r) => r.label).join(', ') || 'ไม่มีอุปกรณ์พิเศษ มีแค่กระดานและกระดาษ'
  const lib = LIBRARY.map((a) => `- ${a.name} (${a.phase}, ${a.min}-${a.max} นาที${a.needs.length ? `, ต้องใช้ ${a.needs.join('/')}` : ''})`).join('\n')
  return [
    `เขียนแผนการจัดการเรียนรู้แบบ Active Learning ภาษาไทย จากแผนบรรยายเดิมด้านล่าง`,
    `วิชา: ${ctx.subject || '-'} | ชั้น: ${ctx.grade || '-'} | เรื่อง: ${ctx.topic || '-'}`,
    `เวลา: ${ctx.minutes} นาที (ผลรวม minutes ของทุกขั้นต้องเท่ากับ ${ctx.minutes} พอดี)`,
    `นักเรียน: ${ctx.students} คน | ห้องนี้มี: ${have}`,
    `ตัวชี้วัด (ใช้รหัสตามนี้ในช่อง indicators และ rubric): ${ctx.indicators.map((i) => `${indicatorKey(i)} = ${i.text}`).join(' ; ') || 'ไม่มี'}`,
    `กติกา: มี 4 ขั้นเรียงตาม engage, learn, practice, reflect อย่างละ 1 ขั้น | ทุกขั้นต้องผูกตัวชี้วัดอย่างน้อย 1 ข้อ | ทุกตัวชี้วัดต้องมีขั้นรองรับและมีแถวใน rubric (levels 4 ระดับ: ดีมาก ดี พอใช้ ปรับปรุง) | ห้ามใช้อุปกรณ์ที่ห้องไม่มี | talkShare คือสัดส่วนเวลาที่ครูพูด (0-1) รวมทั้งคาบไม่ควรเกิน 0.4 | ขั้นตอนต้องทำได้จริงกับนักเรียน ${ctx.students} คน`,
    `กิจกรรมที่ใช้ได้ดี (เลือกหรือปรับได้):\n${lib}`,
    ...(includeSchema ? [`ตอบเป็น JSON ตาม JSON Schema นี้:\n${JSON.stringify(PLAN_SCHEMA)}`] : []),
    `แผนบรรยายเดิม:\n${oldPlan.slice(0, 6000)}`,
  ].join('\n\n')
}

type RawPlan = { stages?: unknown; objectives?: Plan['objectives']; worksheet?: unknown; rubric?: unknown }

// Turns any provider's JSON into a Plan, tolerating the small slips non-strict providers make.
export function toPlan(ctx: Context, text: string): Plan {
  let out: RawPlan
  try {
    out = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  } catch {
    throw new Error('AI ส่งแผนกลับมาในรูปแบบที่อ่านไม่ได้')
  }
  if (!Array.isArray(out.stages) || !out.stages.length) throw new Error('AI ไม่ได้ส่งขั้นกิจกรรมกลับมา')
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : [])
  const stages: Stage[] = (out.stages as Record<string, unknown>[]).map((x) => ({
    phase: (PHASE_IDS.includes(x.phase as Phase) ? x.phase : 'learn') as Phase,
    activityId: 'ai',
    name: String(x.name ?? 'กิจกรรม'),
    minutes: Math.max(0, Math.round(Number(x.minutes) || 0)),
    why: String(x.why ?? ''),
    teacher: list(x.teacher), students: list(x.students), materials: list(x.materials),
    check: String(x.check ?? ''),
    indicators: list(x.indicators),
    talkShare: Math.min(1, Math.max(0, Number(x.talkShare) || 0)),
  }))
  const rubricIn = Array.isArray(out.rubric) ? (out.rubric as { indicator?: unknown; levels?: unknown }[]) : []
  const rows: RubricRow[] = rubricIn.length
    ? rubricIn.map((r) => { const l = list(r.levels); return { indicator: String(r.indicator ?? ''), levels: [l[0] ?? '', l[1] ?? '', l[2] ?? '', l[3] ?? ''] } })
    : defaultRubric(ctx)
  const plan = assemble(ctx, stages, 1, 'ai', [])
  const ws = list(out.worksheet)
  const o = out.objectives
  return { ...plan, objectives: o && o.k ? { k: String(o.k), p: String(o.p ?? ''), a: String(o.a ?? '') } : plan.objectives, worksheet: ws.length ? ws : plan.worksheet, rubric: rows }
}

export async function writeWithAi(ctx: Context, oldPlan: string, s: AiSettings): Promise<Plan> {
  const key = keyOf(s)
  const model = modelOf(s)
  if (s.provider === 'compatible' ? !s.baseUrl.trim() : !key) throw new Error(s.provider === 'compatible' ? 'ยังไม่ได้ใส่ Base URL' : 'ยังไม่ได้ใส่ API key')
  if (!model) throw new Error('ยังไม่ได้เลือกโมเดล')
  const strict = s.provider === 'openai' || s.provider === 'anthropic'
  const user = buildPrompt(ctx, oldPlan, !strict)
  const text =
    s.provider === 'openai' ? await writeOpenAiStrict(key, model, SYSTEM, user, PLAN_SCHEMA)
      : s.provider === 'anthropic' ? await writeClaude(key, model, SYSTEM, user, PLAN_SCHEMA)
        : s.provider === 'gemini' ? await writeGemini(key, model, SYSTEM, user)
          : await writeCompatible(s.baseUrl, key, model, SYSTEM, user)
  return toPlan(ctx, text)
}
