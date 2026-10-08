import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { loadAi, writeWithAi, type AiSettings } from './ai'
import { generate } from './engine'
import { currentPlan, useAppState, type Step } from './store'
import { AfterStep } from './components/AfterStep'
import { AiPanel } from './components/AiPanel'
import { InputStep } from './components/InputStep'
import { PlanStep } from './components/PlanStep'
import { Mark, T } from './components/ui'

const STEPS: { id: Step; label: string }[] = [
  { id: 'input', label: 'แผนเดิมและห้องเรียน' },
  { id: 'plan', label: 'แผนใหม่' },
  { id: 'after', label: 'บันทึกหลังสอน' },
]

export default function App() {
  const store = useAppState()
  const { state, update } = store
  const [ai, setAi] = useState<AiSettings>(loadAi)
  const [aiOpen, setAiOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = (step: Step) => { update((s) => ({ ...s, step })); window.scrollTo({ top: 0 }) }

  const convert = async (mode: 'library' | 'ai') => {
    setError('')
    if (mode === 'library') {
      update((s) => ({ ...s, history: [generate(s.ctx, 0)], current: 0, tried: [], variant: 0, step: 'plan' }))
      window.scrollTo({ top: 0 })
      return
    }
    setBusy(true)
    try {
      const plan = await writeWithAi(state.ctx, state.oldPlan, ai)
      update((s) => ({ ...s, history: [plan], current: 0, tried: [], variant: 0, step: 'plan' }))
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(`${(e as Error).message} ลองอีกครั้ง หรือใช้ “แปลงเป็นแผน Active Learning” จากคลังกิจกรรมแทน`)
    } finally { setBusy(false) }
  }
  const regenerate = () => update((s) => {
    const variant = s.variant + 1
    return { ...s, variant, history: [generate(s.ctx, variant)], current: 0 }
  })

  const plan = currentPlan(state)

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[72rem] items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <a href="#" onClick={(e) => { e.preventDefault(); go('input') }} className="flex items-center gap-2.5" aria-label="ALPC หน้าแรก">
            <Mark />
            <span className="leading-tight">
              <span className="block font-[family-name:var(--font-display)] text-[1.0625rem] font-semibold">ALPC</span>
              <span className="block text-[0.75rem] text-ink-3">แผนการสอนใหม่ · Active Learning</span>
            </span>
          </a>
          <button className="btn btn-quiet btn-sm" onClick={() => setAiOpen(!aiOpen)} aria-expanded={aiOpen}>
            <Sparkles size={15} aria-hidden />
            {ai.apiKey && ai.model ? <span className="max-w-[9rem] truncate">AI: {ai.model}</span> : 'AI'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[72rem] px-4 pb-24 sm:px-8">
        {aiOpen && <AiPanel ai={ai} setAi={setAi} onClose={() => setAiOpen(false)} />}

        {state.step === 'input' && (
          <section className="pb-8 pt-10 sm:pt-14">
            <h1 className="max-w-[46rem] text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.25]">
              <T>เปลี่ยนแผนบรรยาย|เป็นคาบที่นักเรียน|ได้ลงมือทำ</T>
            </h1>
            <p className="mt-4 max-w-[42rem] text-[1.0625rem] leading-relaxed text-ink-2">
              วางแผนการสอนเดิม บอกว่าห้องเรียนมีอะไร แล้วได้แผน Active Learning ที่ทำได้จริงในห้อง 40 คนแม้ไม่มีโปรเจกเตอร์
              พร้อมใบงานและ rubric ที่ผูกกับตัวชี้วัดทุกข้อ ส่งออกเป็น Word ได้ทันที
            </p>
          </section>
        )}

        <nav className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-line bg-paper/95 px-4 backdrop-blur sm:-mx-8 sm:px-8" aria-label="ขั้นตอน">
          {STEPS.map((s, i) => {
            const on = state.step === s.id
            return (
              <button key={s.id} onClick={() => go(s.id)} aria-current={on ? 'step' : undefined}
                className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-3.5 font-medium transition-colors ${on ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
                <span className={`grid size-6 place-items-center rounded-full text-[0.75rem] num ${on ? 'bg-board text-chalk' : 'bg-line text-ink-2'}`}>{i + 1}</span>
                {s.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-board" />}
              </button>
            )
          })}
        </nav>

        {state.step === 'input' && <InputStep store={store} ai={ai} onConvert={convert} busy={busy} error={error} />}
        {state.step === 'plan' && <PlanStep store={store} onRegenerate={regenerate} />}
        {state.step === 'after' && <AfterStep key={`${state.current}-${plan.version}`} store={store} />}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[72rem] flex-col gap-1 px-4 py-6 text-[0.8125rem] text-ink-3 sm:flex-row sm:justify-between sm:px-8">
          <p>ALPC · ไอเดีย #309 ใน Idea Bank</p>
          <p>ต่อยอดจาก Nexora-AI และ Edu.AI (Agent Development Kit Hackathon with Google Cloud 2025)</p>
        </div>
      </footer>
    </div>
  )
}
