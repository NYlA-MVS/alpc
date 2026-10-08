import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Thai has no spaces between words; mark phrase boundaries with | so headings never break mid-word.
export function T({ children }: { children: string }) {
  const parts = children.split('|')
  return <>{parts.map((p, i) => <span key={i} className="inline-block">{p}{i < parts.length - 1 ? ' ' : ''}</span>)}</>
}

export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--board)" />
      <rect x="5" y="20" width="22" height="5" rx="1.5" fill="var(--chalk)" />
      <rect x="5" y="20" width="6" height="5" rx="1.5" fill="var(--on-board)" />
      <path d="M8 15l5-6 4 4 7-6" stroke="var(--on-board)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Select({ id, value, onChange, label, children }: { id: string; value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex w-full">
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>{children}</select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
    </span>
  )
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[0.875rem] font-medium text-ink-2">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[0.8125rem] text-ink-3">{hint}</p>}
    </div>
  )
}
