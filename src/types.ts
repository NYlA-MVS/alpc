// The four stages Thai lesson plans already use (ขั้นนำ / ขั้นสอน / ขั้นฝึก / ขั้นสรุป).
export type Phase = 'engage' | 'learn' | 'practice' | 'reflect'

export type Resource = 'projector' | 'internet' | 'devices' | 'space' | 'print'

export interface Indicator {
  code: string // e.g. "ว 3.1 ป.6/1"; may be empty when the plan has none
  text: string
}

export interface Context {
  subject: string
  grade: string
  topic: string
  indicators: Indicator[]
  minutes: number
  students: number
  resources: Resource[]
}

export interface Activity {
  id: string
  name: string
  phase: Phase
  min: number
  max: number
  groupSize: number // 1 = individual, 2 = pairs, 0 = whole class
  needs: Resource[]
  summary: string
  why: string
  teacher: string[] // steps; {topic} is filled in
  students: string[]
  materials: string[]
  check: string // how the teacher sees learning during this stage
  worksheet?: string // a worksheet item this activity contributes; {topic} is filled in
  talkShare: number // share of the stage the teacher is talking (0–1)
}

export interface Stage {
  phase: Phase
  activityId: string // library id, or "ai" when written by the AI
  name: string
  minutes: number
  why: string
  teacher: string[]
  students: string[]
  materials: string[]
  check: string
  indicators: string[] // indicator codes (or texts when there is no code)
  talkShare: number
}

export interface RubricRow {
  indicator: string
  levels: [string, string, string, string] // 4 ดีมาก, 3 ดี, 2 พอใช้, 1 ปรับปรุง
}

export interface Plan {
  version: number
  source: 'library' | 'ai'
  context: Context
  stages: Stage[]
  objectives: { k: string; p: string; a: string }
  worksheet: string[]
  rubric: RubricRow[]
  changes: string[] // what changed from the previous version, and why
}

export type StageResult = 'worked' | 'ok' | 'failed'

export interface Feedback {
  stage: number
  result: StageResult
  overtime: boolean
  note: string
}

export interface OldPlanReading {
  topic: string
  subject: string
  grade: string
  indicators: Indicator[]
  minutes: number
  steps: { text: string; minutes: number; teacherTalk: boolean }[]
  talkMinutes: number
  activeMinutes: number
  foundMinutes: boolean // the period length was stated in the plan, not guessed
}

export type Rule = 'time' | 'stage-indicator' | 'coverage' | 'rubric' | 'resources' | 'fit' | 'talk'

export interface Issue {
  level: 'error' | 'warn'
  rule: Rule
  text: string
}
