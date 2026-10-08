import type { Indicator, OldPlanReading } from './types'

// Reads a Thai lesson plan written in the usual school format and pulls out what the converter needs.

const TALK = /ครู(?:บรรยาย|อธิบาย|สรุป|ทบทวน|เล่า|แสดง|ให้ดู|อ่าน|ชี้แจง|นำเสนอ)/
const ACTIVE = /นักเรียน.*?(?:ทำกิจกรรม|อภิปราย|ทดลอง|สร้าง|นำเสนอ|แข่งขัน|สืบค้น|ค้นหา|แก้โจทย์|ระดมสมอง|ทำงานกลุ่ม|ทำแบบฝึก|ทำใบงาน|ตอบคำถาม)/
const INDICATOR = /^([กขคงจฉชซญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ]\s?\d+\.\d+\s?[ปม]\.\s?\d+\/\d+)\s+(.+)$/
const STAGE = /^(ขั้น[^\s(（]+)[^(（]*[(（]\s*(\d+)\s*นาที\s*[)）]/
const STEP = /^\d+[.)]\s*(.+)$/
const STEP_MIN = /[(（]\s*(\d+)\s*นาที\s*[)）]/

export function readOldPlan(text: string): OldPlanReading {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const all = lines.join('\n')

  const topic = all.match(/เรื่อง\s+([^\n]+?)(?:\s{2,}|\s+เวลา|\n|$)/)?.[1]?.trim() ?? ''
  const subject = all.match(/(?:กลุ่มสาระการเรียนรู้|รายวิชา)\s*([^\s\n]+)/)?.[1]?.trim() ?? ''
  const g = all.match(/ชั้น(ประถม|มัธยม)ศึกษาปีที่\s*(\d)/) ?? all.match(/\b([ปม])\.\s?(\d)\b/)
  const grade = g ? `${g[1].startsWith('ป') ? 'ป.' : 'ม.'}${g[2]}` : ''

  let minutes = 0
  const hours = all.match(/เวลา\s*(\d+(?:\.\d+)?)\s*ชั่วโมง/)
  const mins = all.match(/เวลา\s*(\d+)\s*นาที/)
  if (hours) minutes = Math.round(parseFloat(hours[1]) * 60)
  else if (mins) minutes = parseInt(mins[1], 10)

  const indicators: Indicator[] = []
  for (const l of lines) {
    const m = l.match(INDICATOR)
    if (m) indicators.push({ code: m[1].replace(/\s+/g, ' '), text: m[2].trim() })
  }

  // Steps, with minutes from the step itself or shared out from its stage header.
  const raw: { text: string; minutes: number | null; stageMinutes: number | null; stageKey: number }[] = []
  let stageMinutes: number | null = null
  let stageKey = 0
  for (const l of lines) {
    const st = l.match(STAGE)
    if (st) { stageMinutes = parseInt(st[2], 10); stageKey++; continue }
    const sp = l.match(STEP)
    if (sp && !INDICATOR.test(l)) {
      const own = sp[1].match(STEP_MIN)
      raw.push({ text: sp[1].replace(STEP_MIN, '').trim(), minutes: own ? parseInt(own[1], 10) : null, stageMinutes, stageKey })
    }
  }
  const steps = raw.map((s) => {
    let m = s.minutes
    if (m === null && s.stageMinutes !== null) {
      const same = raw.filter((x) => x.stageKey === s.stageKey)
      const taken = same.reduce((a, x) => a + (x.minutes ?? 0), 0)
      const open = same.filter((x) => x.minutes === null).length
      m = Math.max(0, Math.round((s.stageMinutes - taken) / open))
    }
    const teacherTalk = TALK.test(s.text) && !ACTIVE.test(s.text)
    return { text: s.text, minutes: m ?? 0, teacherTalk }
  })

  const stepTotal = steps.reduce((a, s) => a + s.minutes, 0)
  if (!minutes) minutes = stepTotal || 60
  const talkMinutes = steps.filter((s) => s.teacherTalk).reduce((a, s) => a + s.minutes, 0)
  return { topic, subject, grade, indicators, minutes, steps, talkMinutes, activeMinutes: Math.max(0, (stepTotal || minutes) - talkMinutes) }
}
