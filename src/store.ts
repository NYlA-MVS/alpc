import { useEffect, useState } from 'react'
import { generate } from './engine'
import { contextFrom, SAMPLE_PLAN } from './sample'
import type { Context, Plan } from './types'

export type Step = 'input' | 'plan' | 'after'

export interface State {
  oldPlan: string
  ctx: Context
  history: Plan[] // every version, newest last
  current: number // index into history
  tried: string[] // activity ids that failed in a past lesson
  variant: number
  step: Step
}

const KEY = 'alpc:state:v1'

export function sampleState(): State {
  const ctx = contextFrom(SAMPLE_PLAN)
  return { oldPlan: SAMPLE_PLAN, ctx, history: [generate(ctx)], current: 0, tried: [], variant: 0, step: 'input' }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch { /* storage unavailable or corrupt */ }
  return sampleState()
}

export function useAppState() {
  const [state, setState] = useState<State>(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
  }, [state])
  const update = (fn: (s: State) => State) => setState((s) => fn(s))
  return { state, setState, update }
}

export type Store = ReturnType<typeof useAppState>
export const currentPlan = (s: State) => s.history[s.current]
