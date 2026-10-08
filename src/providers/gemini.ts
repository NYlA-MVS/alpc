// Google Gemini (Generative Language API) with the teacher's own key.

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

async function call(path: string, key: string, body?: unknown) {
  let res: Response
  try {
    res = await fetch(`${BASE}/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('เชื่อมต่อ Gemini ไม่ได้ ตรวจอินเทอร์เน็ต หรือหน้านี้อาจถูกจำกัดการเชื่อมต่อภายนอก')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText
    if (res.status === 400 && /api key/i.test(msg)) throw new Error('Gemini API key ไม่ถูกต้อง')
    if (res.status === 403) throw new Error('key นี้ไม่มีสิทธิ์ใช้ Gemini API หรือยังไม่ได้เปิดใช้ API ในโปรเจกต์')
    if (res.status === 429) throw new Error('บัญชี Gemini ถึงขีดจำกัดการใช้งาน ลองใหม่อีกครั้งในอีกสักครู่')
    throw new Error(`Gemini ตอบกลับว่า: ${msg}`)
  }
  return data
}

export async function listGeminiModels(key: string): Promise<string[]> {
  const data = (await call('models?pageSize=200', key)) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name) && !/(embedding|image|tts|audio|live)/.test(m.name))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort()
}

export async function writeGemini(key: string, model: string, system: string, user: string): Promise<string> {
  const data = (await call(`models/${encodeURIComponent(model)}:generateContent`, key, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json' },
  })) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini ปฏิเสธคำขอนี้ (${data.promptFeedback.blockReason})`)
  const c = data.candidates?.[0]
  const text = c?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error(c?.finishReason ? `Gemini ไม่ได้ส่งแผนกลับมา (${c.finishReason})` : 'Gemini ไม่ได้ส่งแผนกลับมา')
  return text
}
