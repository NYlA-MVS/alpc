import { useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { listModels, saveAi, type AiSettings } from '../ai'
import { Field, Select } from './ui'

export function AiPanel({ ai, setAi, onClose }: { ai: AiSettings; setAi: (s: AiSettings) => void; onClose: () => void }) {
  const [key, setKey] = useState(ai.apiKey)
  const [models, setModels] = useState<string[]>(ai.model ? [ai.model] : [])
  const [model, setModel] = useState(ai.model)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setBusy(true); setMsg('')
    try {
      const list = await listModels(key.trim())
      setModels(list)
      if (!list.includes(model)) setModel(list[0] ?? '')
      setMsg(list.length ? `พบ ${list.length} โมเดลในบัญชีนี้` : 'ไม่พบโมเดลที่ใช้เขียนข้อความได้ในบัญชีนี้')
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const save = () => {
    const s = { apiKey: key.trim(), model }
    saveAi(s); setAi(s); onClose()
  }
  const clear = () => { const s = { apiKey: '', model: '' }; saveAi(s); setAi(s); setKey(''); setModels([]); setModel('') }

  return (
    <section className="sheet relative mt-4 p-5 sm:p-6" aria-labelledby="ai-title">
      <button className="absolute right-4 top-4 text-ink-3 hover:text-ink" onClick={onClose} aria-label="ปิดการตั้งค่า AI"><X size={18} /></button>
      <h2 id="ai-title" className="flex items-center gap-2 text-[1.25rem]"><KeyRound size={18} aria-hidden />ให้ AI ช่วยเขียนแผน (ไม่บังคับ)</h2>
      <p className="mt-1 max-w-[46rem] text-[0.9375rem] text-ink-2">
        ใช้ OpenAI API key ของคุณเอง key เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งไปที่ api.openai.com โดยตรง ค่าใช้งานคิดกับบัญชีของคุณ
        แผนที่ AI เขียนจะถูกตรวจด้วยกติกาเดียวกับแผนจากคลังกิจกรรม
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Field label="OpenAI API key" htmlFor="ai-key"><input id="ai-key" type="password" autoComplete="off" className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-…" /></Field>
        <Field label="โมเดล" htmlFor="ai-model">
          <Select id="ai-model" value={model} onChange={setModel} label="โมเดล">
            {!models.length && <option value="">กด “โหลดรายชื่อโมเดล” ก่อน</option>}
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <button className="btn btn-quiet" onClick={load} disabled={!key.trim() || busy}>{busy ? 'กำลังโหลด…' : 'โหลดรายชื่อโมเดล'}</button>
      </div>
      {msg && <p className="mt-2 text-[0.875rem] text-ink-2" role="status">{msg}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn btn-board" onClick={save} disabled={!key.trim() || !model}>บันทึก</button>
        {ai.apiKey && <button className="btn btn-quiet" onClick={clear}>ลบ key ออกจากเครื่องนี้</button>}
      </div>
    </section>
  )
}
