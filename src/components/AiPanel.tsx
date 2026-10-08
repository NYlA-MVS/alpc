import { useState } from 'react'
import { ExternalLink, KeyRound, X } from 'lucide-react'
import { aiName, COMPATIBLE_PRESETS, keyOf, listModels, modelOf, PROVIDERS, saveAi, type AiSettings, type ProviderId } from '../ai'
import { Field, Select } from './ui'

export function AiPanel({ ai, setAi, onClose }: { ai: AiSettings; setAi: (s: AiSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<AiSettings>(ai)
  const [models, setModels] = useState<Partial<Record<ProviderId, string[]>>>(() => Object.fromEntries(PROVIDERS.map((p) => [p.id, modelOf(ai, p.id) ? [modelOf(ai, p.id)] : []])))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const p = draft.provider
  const meta = PROVIDERS.find((x) => x.id === p)!
  const list = models[p] ?? []
  const key = keyOf(draft)
  const canList = p === 'compatible' ? !!draft.baseUrl.trim() : !!key

  const setKey = (v: string) => setDraft((d) => ({ ...d, keys: { ...d.keys, [p]: v } }))
  const setModel = (v: string) => setDraft((d) => ({ ...d, models: { ...d.models, [p]: v } }))

  const load = async () => {
    setBusy(true); setMsg('')
    try {
      const { models: found, suggested } = await listModels(draft)
      setModels((m) => ({ ...m, [p]: found }))
      if (!found.includes(modelOf(draft))) setModel(suggested ?? found[0] ?? '')
      setMsg(found.length ? `พบ ${found.length} โมเดล` : 'ไม่พบโมเดลที่ใช้เขียนข้อความได้ พิมพ์ชื่อโมเดลเองได้ด้านล่าง')
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const save = () => { saveAi(draft); setAi(draft); onClose() }
  const clear = () => {
    const next = { ...draft, keys: { ...draft.keys, [p]: '' }, models: { ...draft.models, [p]: '' } }
    setDraft(next); saveAi(next); setAi(next); setModels((m) => ({ ...m, [p]: [] }))
  }
  const name = aiName(draft)
  const ready = !!modelOf(draft) && (p === 'compatible' ? !!draft.baseUrl.trim() : !!key)

  return (
    <section className="sheet relative mt-4 p-5 sm:p-6" aria-labelledby="ai-title">
      <button className="absolute right-4 top-4 text-ink-3 hover:text-ink" onClick={onClose} aria-label="ปิดการตั้งค่า AI"><X size={18} /></button>
      <h2 id="ai-title" className="flex items-center gap-2 text-[1.25rem]"><KeyRound size={18} aria-hidden />ให้ AI ช่วยเขียนแผน (ไม่บังคับ)</h2>
      <p className="mt-1 max-w-[48rem] text-[0.9375rem] text-ink-2">
        เลือกผู้ให้บริการและใช้ key ของคุณเอง key เก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งไปที่ผู้ให้บริการที่เลือกโดยตรง ค่าใช้งานคิดกับบัญชีของคุณ
        ไม่ว่าใช้เจ้าไหน แผนจะถูกตรวจด้วยกติกาเดียวกับแผนจากคลังกิจกรรม
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="ผู้ให้บริการ AI">
        {PROVIDERS.map((x) => {
          const on = x.id === p
          const has = x.id === 'compatible' ? !!draft.baseUrl && !!modelOf(draft, x.id) : !!keyOf(draft, x.id) && !!modelOf(draft, x.id)
          return (
            <button key={x.id} role="radio" aria-checked={on} onClick={() => { setDraft((d) => ({ ...d, provider: x.id })); setMsg('') }}
              className={`rounded-full px-4 py-2 text-[0.9375rem] font-medium transition-colors ${on ? 'bg-board text-on-board' : 'bg-paper text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-ink'}`}>
              {x.label}{has && <span className={`ml-1.5 inline-block size-2 rounded-full align-middle ${on ? 'bg-chalk' : 'bg-board'}`} aria-label="ตั้งค่าแล้ว" />}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[0.875rem] text-ink-3">{meta.note}</p>

      {p === 'compatible' && (
        <div className="mt-4">
          <Field label="Base URL" htmlFor="ai-base" hint="ต้องลงท้ายด้วย /v1 ตามที่ผู้ให้บริการกำหนด">
            <input id="ai-base" className="field" value={draft.baseUrl} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))} placeholder="https://…/v1" />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMPATIBLE_PRESETS.map((x) => (
              <button key={x.url} className="rounded-full bg-paper px-3 py-1 text-[0.8125rem] text-ink-2 shadow-[inset_0_0_0_1px_var(--line-2)] hover:text-ink" onClick={() => setDraft((d) => ({ ...d, baseUrl: x.url }))}>{x.label}</button>
            ))}
          </div>
          {draft.baseUrl.startsWith('http://localhost') && <p className="mt-2 text-[0.8125rem] text-ink-3">Ollama ต้องเปิดให้เว็บนี้เรียกได้ เช่นตั้งค่า OLLAMA_ORIGINS ให้ครอบคลุมโดเมนของหน้านี้</p>}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Field label={meta.keyLabel} htmlFor="ai-key">
          <input id="ai-key" type="password" autoComplete="off" className="field" value={draft.keys[p] ?? ''} onChange={(e) => setKey(e.target.value)} placeholder={meta.keyPlaceholder} />
        </Field>
        <Field label="โมเดล" htmlFor="ai-model">
          {list.length > 0 ? (
            <Select id="ai-model" value={modelOf(draft)} onChange={setModel} label="โมเดล">
              {list.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          ) : (
            <input id="ai-model" className="field" value={modelOf(draft)} onChange={(e) => setModel(e.target.value)} placeholder="กด “โหลดรายชื่อโมเดล” หรือพิมพ์ชื่อโมเดล" />
          )}
        </Field>
        <button className="btn btn-quiet" onClick={load} disabled={!canList || busy}>{busy ? 'กำลังโหลด…' : 'โหลดรายชื่อโมเดล'}</button>
      </div>
      {msg && <p className="mt-2 text-[0.875rem] text-ink-2" role="status">{msg}</p>}
      {meta.keyUrl && (
        <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[0.875rem] text-ink-3 underline underline-offset-4 hover:text-ink">
          ขอ key ของ {meta.label}<ExternalLink size={13} aria-hidden />
        </a>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn btn-board" onClick={save} disabled={!ready}>บันทึกและใช้ {name}</button>
        {(draft.keys[p] || modelOf(draft)) && <button className="btn btn-quiet" onClick={clear}>ลบค่าของ {name} ออกจากเครื่องนี้</button>}
      </div>
    </section>
  )
}
