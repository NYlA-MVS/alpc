import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

// What the AI is roughly doing, by elapsed seconds. The request is a single call, so this is a guide, not real progress.
const STAGES: { from: number; text: string }[] = [
  { from: 0, text: 'ส่งแผนเดิมและข้อมูลห้องเรียนให้ AI' },
  { from: 4, text: 'ออกแบบกิจกรรม 4 ขั้น: นำ สอน ฝึก สรุป' },
  { from: 20, text: 'เขียนใบงาน จุดประสงค์ และ rubric ตามตัวชี้วัด' },
  { from: 45, text: 'ตรวจเวลาและความสอดคล้องกับตัวชี้วัด' },
  { from: 90, text: 'ใช้เวลานานกว่าปกติ ยังรอคำตอบจากผู้ให้บริการอยู่' },
]

export function AiProgress({ name, onCancel }: { name: string; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  const at = STAGES.filter((s) => seconds >= s.from).length - 1
  // Eases toward 95% so the bar keeps moving without claiming to be done.
  const pct = Math.min(95, 100 * (1 - Math.exp(-seconds / 40)))

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="ai-progress-title">
      <div className="sheet w-full max-w-[28rem] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-board text-chalk">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-chalk/25 border-t-chalk" aria-hidden />
            <Sparkles size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="ai-progress-title" className="text-[1.125rem]">{name} กำลังเขียนแผนการสอน</h2>
            <p className="num text-[0.875rem] text-ink-3">ผ่านไป {seconds} วินาที · ปกติใช้ 20–90 วินาที</p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-board transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-4 space-y-1.5 text-[0.9375rem]" aria-live="polite">
          {STAGES.slice(0, 4).map((s, i) => (
            <li key={s.text} className={`flex items-center gap-2 ${i < at ? 'text-ink-3' : i === at ? 'font-medium text-ink' : 'text-ink-3/60'}`}>
              <span className={`size-2 shrink-0 rounded-full ${i < at ? 'bg-board' : i === at ? 'animate-pulse bg-chalk' : 'bg-line-2'}`} aria-hidden />
              {s.text}
            </li>
          ))}
        </ol>
        {at === 4 && <p className="mt-3 text-[0.875rem] text-ink-2" role="status">{STAGES[4].text}</p>}

        <p className="mt-4 text-[0.8125rem] text-ink-3">เสร็จแล้วจะพาไปหน้า “แผนใหม่” ให้เอง ไม่ต้องปิดหน้านี้</p>
        <button className="btn btn-quiet btn-sm mt-3" onClick={onCancel}>ยกเลิก</button>
      </div>
    </div>
  )
}
