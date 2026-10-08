import { assemble, indicatorKey, rubric as defaultRubric } from './engine'
import { LIBRARY, PHASES, RESOURCES } from './library'
import type { Context, Phase, Plan, RubricRow, Stage } from './types'

// Optional AI writer. Calls OpenAI straight from the teacher's browser with the teacher's own key;
// the key never leaves this device except to api.openai.com.

const KEY = 'alpc:openai'
export interface AiSettings { apiKey: string; model: string }

export function loadAi(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AiSettings
  } catch { /* storage unavailable */ }
  return { apiKey: '', model: '' }
}
export function saveAi(s: AiSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
}

async function call(path: string, key: string, body?: unknown) {
  let res: Response
  try {
    res = await fetch(`https://api.openai.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('เชื่อมต่อ OpenAI ไม่ได้ ตรวจอินเทอร์เน็ต หรือหน้านี้อาจถูกจำกัดการเชื่อมต่อภายนอก')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText
    if (res.status === 401) throw new Error('API key ไม่ถูกต้อง หรือถูกยกเลิกแล้ว')
    if (res.status === 429) throw new Error('บัญชี OpenAI ถึงขีดจำกัดการใช้งานหรือเครดิตหมด')
    throw new Error(`OpenAI ตอบกลับว่า: ${msg}`)
  }
  return data
}

// Model names change often, so the list comes from the account instead of being hard-coded.
export async function listModels(key: string): Promise<string[]> {
  const data = (await call('models', key)) as { data: { id: string }[] }
  return data.data
    .map((m) => m.id)
    .filter((id) => /^(gpt|o\d)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|codex)/.test(id))
    .sort()
}

const PHASE_IDS = PHASES.map((p) => p.id)
const str = { type: 'string' }
const strs = { type: 'array', items: str }

const SCHEMA = {
  name: 'active_learning_plan',
  strict: true,
  schema: {
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
  },
}

function prompt(ctx: Context, oldPlan: string) {
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
    `แผนบรรยายเดิม:\n${oldPlan.slice(0, 6000)}`,
  ].join('\n\n')
}

export async function writeWithAi(ctx: Context, oldPlan: string, s: AiSettings): Promise<Plan> {
  if (!s.apiKey) throw new Error('ยังไม่ได้ใส่ OpenAI API key')
  if (!s.model) throw new Error('ยังไม่ได้เลือกโมเดล')
  const data = (await call('chat/completions', s.apiKey, {
    model: s.model,
    messages: [
      { role: 'system', content: 'คุณเป็นศึกษานิเทศก์ที่เชี่ยวชาญการออกแบบการเรียนรู้เชิงรุกในโรงเรียนไทย ตอบเป็น JSON ตาม schema เท่านั้น' },
      { role: 'user', content: prompt(ctx, oldPlan) },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
  })) as { choices: { message: { content: string | null; refusal?: string | null } }[] }

  const msg = data.choices?.[0]?.message
  if (!msg?.content) throw new Error(msg?.refusal ? `AI ปฏิเสธคำขอ: ${msg.refusal}` : 'AI ไม่ได้ส่งแผนกลับมา')
  let out: {
    stages: Omit<Stage, 'activityId'>[]; objectives: Plan['objectives']; worksheet: string[]; rubric: { indicator: string; levels: string[] }[]
  }
  try { out = JSON.parse(msg.content) } catch { throw new Error('AI ส่งแผนกลับมาในรูปแบบที่อ่านไม่ได้') }
  if (!Array.isArray(out.stages) || !out.stages.length) throw new Error('AI ไม่ได้ส่งขั้นกิจกรรมกลับมา')
  const stages: Stage[] = out.stages.map((x) => ({
    ...x, phase: x.phase as Phase, activityId: 'ai', minutes: Math.max(0, Math.round(x.minutes)), talkShare: Math.min(1, Math.max(0, x.talkShare)),
  }))
  const rows: RubricRow[] = out.rubric?.length
    ? out.rubric.map((r) => ({ indicator: r.indicator, levels: [r.levels[0] ?? '', r.levels[1] ?? '', r.levels[2] ?? '', r.levels[3] ?? ''] }))
    : defaultRubric(ctx)
  const plan = assemble(ctx, stages, 1, 'ai', [])
  return { ...plan, objectives: out.objectives ?? plan.objectives, worksheet: out.worksheet?.length ? out.worksheet : plan.worksheet, rubric: rows }
}
