// OpenAI Chat Completions, and any service that speaks the same API (Typhoon, OpenRouter, Groq, Ollama…).

export const OPENAI_URL = 'https://api.openai.com/v1'

async function call(baseUrl: string, path: string, key: string, body?: unknown) {
  let res: Response
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('เชื่อมต่อผู้ให้บริการไม่ได้ ตรวจอินเทอร์เน็ตหรือ Base URL หรือหน้านี้อาจถูกจำกัดการเชื่อมต่อภายนอก')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } | string }).error
    const text = typeof msg === 'string' ? msg : msg?.message ?? res.statusText
    const err = new Error(
      res.status === 401 ? 'API key ไม่ถูกต้อง หรือถูกยกเลิกแล้ว'
        : res.status === 429 ? 'บัญชีถึงขีดจำกัดการใช้งานหรือเครดิตหมด'
          : res.status === 404 ? `ไม่พบโมเดลหรือ endpoint นี้ (${text})`
            : `ผู้ให้บริการตอบกลับว่า: ${text}`,
    ) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

export async function listOpenAiModels(baseUrl: string, key: string, textOnly: boolean): Promise<string[]> {
  const data = (await call(baseUrl, 'models', key)) as { data?: { id: string }[] }
  const ids = (data.data ?? []).map((m) => m.id)
  return (textOnly
    ? ids.filter((id) => /^(gpt|o\d)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|codex)/.test(id))
    : ids
  ).sort()
}

type Reply = { choices?: { message?: { content?: string | null; refusal?: string | null } }[] }

function contentOf(data: Reply) {
  const msg = data.choices?.[0]?.message
  if (!msg?.content) throw new Error(msg?.refusal ? `AI ปฏิเสธคำขอ: ${msg.refusal}` : 'AI ไม่ได้ส่งแผนกลับมา')
  return msg.content
}

// OpenAI itself: strict JSON schema.
export async function writeOpenAiStrict(key: string, model: string, system: string, user: string, schema: object): Promise<string> {
  const data = (await call(OPENAI_URL, 'chat/completions', key, {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: { name: 'active_learning_plan', strict: true, schema } },
  })) as Reply
  return contentOf(data)
}

// Compatible services: ask for a JSON object; if the service rejects that option, ask again without it.
export async function writeCompatible(baseUrl: string, key: string, model: string, system: string, user: string): Promise<string> {
  const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
  try {
    return contentOf((await call(baseUrl, 'chat/completions', key, { ...body, response_format: { type: 'json_object' } })) as Reply)
  } catch (e) {
    if ((e as { status?: number }).status !== 400) throw e
    return contentOf((await call(baseUrl, 'chat/completions', key, body)) as Reply)
  }
}
