import Anthropic from '@anthropic-ai/sdk'

// Claude, called from the teacher's browser with their own key.

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'

const client = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })

// Models that accept output_config.effort, and models that support server-side refusal fallbacks.
const EFFORT = /^claude-(fable|mythos|opus-5|opus-4-[5-8]|sonnet-5|sonnet-4-6)/
const FALLBACK = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/

function explain(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error('Claude API key ไม่ถูกต้อง หรือถูกยกเลิกแล้ว')
  if (e instanceof Anthropic.PermissionDeniedError) return new Error('key นี้ไม่มีสิทธิ์ใช้โมเดลนี้')
  if (e instanceof Anthropic.NotFoundError) return new Error('ไม่พบโมเดลนี้ในบัญชี Claude ลองโหลดรายชื่อโมเดลใหม่')
  if (e instanceof Anthropic.RateLimitError) return new Error('บัญชี Claude ถึงขีดจำกัดการใช้งาน ลองใหม่อีกครั้งในอีกสักครู่')
  if (e instanceof Anthropic.APIConnectionError) return new Error('เชื่อมต่อ Claude ไม่ได้ ตรวจอินเทอร์เน็ต หรือหน้านี้อาจถูกจำกัดการเชื่อมต่อภายนอก')
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402) return new Error('เครดิตของบัญชี Claude หมด')
    return new Error(`Claude ตอบกลับว่า: ${e.message}`)
  }
  return e instanceof Error ? e : new Error(String(e))
}

export async function listClaudeModels(apiKey: string): Promise<string[]> {
  try {
    const ids: string[] = []
    for await (const m of client(apiKey).models.list()) ids.push(m.id)
    return ids
  } catch (e) {
    throw explain(e)
  }
}

export async function writeClaude(apiKey: string, model: string, system: string, user: string, schema: Record<string, unknown>): Promise<string> {
  const c = client(apiKey)
  const output_config = { format: { type: 'json_schema' as const, schema }, ...(EFFORT.test(model) ? { effort: 'medium' as const } : {}) }
  const request = { model, max_tokens: 16000, system, messages: [{ role: 'user' as const, content: user }], output_config }
  let res: { content: { type: string }[]; stop_reason: string | null; stop_details?: { category?: string | null } | null }
  try {
    res = FALLBACK.test(model)
      ? await c.beta.messages.create({ ...request, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await c.messages.create(request)
  } catch (e) {
    throw explain(e)
  }
  if (res.stop_reason === 'refusal') throw new Error(`Claude ปฏิเสธคำขอนี้${res.stop_details?.category ? ` (${res.stop_details.category})` : ''}`)
  if (res.stop_reason === 'max_tokens') throw new Error('แผนยาวเกินกว่าที่ Claude ตอบได้ในครั้งเดียว ลองลดความยาวของแผนเดิม')
  const text = res.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map((b) => b.text).join('')
  if (!text) throw new Error('Claude ไม่ได้ส่งแผนกลับมา')
  return text
}
