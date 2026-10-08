import { talkStats } from './engine'
import { phaseLabel } from './library'
import type { Plan } from './types'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const list = (items: string[]) => `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`

// A Word-compatible HTML document in the standard Thai lesson-plan layout, set in TH Sarabun (Sarabun as fallback).
export function planHtml(plan: Plan): string {
  const c = plan.context
  const { talk, active, total } = talkStats(plan)
  const stages = plan.stages.map((s) => `
    <h3>${esc(phaseLabel(s.phase))}: ${esc(s.name)} (${s.minutes} นาที)</h3>
    <p><b>ตัวชี้วัด:</b> ${esc(s.indicators.join(', ') || '-')}</p>
    <p><b>บทบาทครู</b></p>${list(s.teacher)}
    <p><b>บทบาทนักเรียน</b></p>${list(s.students)}
    <p><b>สื่อ/อุปกรณ์:</b> ${esc(s.materials.join(', ') || '-')}</p>
    <p><b>การตรวจสอบความเข้าใจระหว่างเรียน:</b> ${esc(s.check)}</p>`).join('')
  const rubric = `<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
    <tr><th>ตัวชี้วัด</th><th>4 ดีมาก</th><th>3 ดี</th><th>2 พอใช้</th><th>1 ปรับปรุง</th></tr>
    ${plan.rubric.map((r) => `<tr><td>${esc(r.indicator)}</td>${r.levels.map((l) => `<td>${esc(l)}</td>`).join('')}</tr>`).join('')}
  </table>`
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>body{font-family:"TH Sarabun New","Sarabun",sans-serif;font-size:16pt;line-height:1.4}h1{font-size:20pt;text-align:center}h2{font-size:18pt;margin-top:18pt}h3{font-size:16pt;margin:12pt 0 4pt}td,th{font-size:14pt;vertical-align:top}</style></head><body>
<h1>แผนการจัดการเรียนรู้แบบ Active Learning</h1>
<p><b>กลุ่มสาระการเรียนรู้:</b> ${esc(c.subject || '-')} &nbsp; <b>ชั้น:</b> ${esc(c.grade || '-')}<br>
<b>เรื่อง:</b> ${esc(c.topic || '-')} &nbsp; <b>เวลา:</b> ${c.minutes} นาที &nbsp; <b>จำนวนนักเรียน:</b> ${c.students} คน</p>
<h2>ตัวชี้วัด</h2>${list(c.indicators.map((i) => `${i.code} ${i.text}`.trim()))}
<h2>จุดประสงค์การเรียนรู้</h2>
<p><b>ด้านความรู้ (K):</b> ${esc(plan.objectives.k)}<br><b>ด้านทักษะกระบวนการ (P):</b> ${esc(plan.objectives.p)}<br><b>ด้านคุณลักษณะ (A):</b> ${esc(plan.objectives.a)}</p>
<h2>กิจกรรมการเรียนรู้</h2>
<p>เวลาที่ครูพูดโดยประมาณ ${talk} นาที · นักเรียนลงมือ ${active} นาที จาก ${total} นาที</p>${stages}
<h2>ใบงาน</h2>${list(plan.worksheet)}
<h2>การวัดและประเมินผล (Rubric)</h2>${rubric}
<h2>บันทึกหลังสอน</h2><p>....................................................................................................</p>
</body></html>`
}

export function planText(plan: Plan): string {
  const c = plan.context
  return [
    `แผนการจัดการเรียนรู้แบบ Active Learning`,
    `${c.subject} ${c.grade} · เรื่อง ${c.topic} · ${c.minutes} นาที · ${c.students} คน`,
    '', 'ตัวชี้วัด', ...c.indicators.map((i) => `- ${i.code} ${i.text}`.trim()),
    '', 'จุดประสงค์', `K: ${plan.objectives.k}`, `P: ${plan.objectives.p}`, `A: ${plan.objectives.a}`,
    '', 'กิจกรรมการเรียนรู้',
    ...plan.stages.flatMap((s) => [`${phaseLabel(s.phase)}: ${s.name} (${s.minutes} นาที)`, ...s.teacher.map((t) => `  ครู: ${t}`), ...s.students.map((t) => `  นักเรียน: ${t}`), `  ตรวจสอบ: ${s.check}`]),
    '', 'ใบงาน', ...plan.worksheet.map((w, i) => `${i + 1}. ${w}`),
    '', 'Rubric', ...plan.rubric.map((r) => `${r.indicator}: 4) ${r.levels[0]} 3) ${r.levels[1]} 2) ${r.levels[2]} 1) ${r.levels[3]}`),
  ].join('\n')
}

export function downloadWord(plan: Plan) {
  const blob = new Blob(['﻿', planHtml(plan)], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const topic = (plan.context.topic || 'บทเรียน').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)
  a.download = `แผน-active-learning-${topic}-v${plan.version}.doc`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
