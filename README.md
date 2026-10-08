# ALPC: Active Learning Plan Converter

Turns a Thai lecture-style lesson plan into an active-learning plan that works in a real classroom (40 students, no projector), with a worksheet and a rubric tied to every indicator, and adapts the next lesson from the teacher's post-lesson notes.

Idea bank #309 · Track T2 · SDG 4 · estimated score 4/4/4/4 = 16 (Claude estimate, not a result)
Based on: [Nexora-AI](https://cloud.google.com/blog/products/ai-machine-learning/adk-hackathon-results-winners-and-highlights) (Agent Development Kit Hackathon with Google Cloud 2025 (online), EMEA winner); [Edu.AI](https://cloud.google.com/blog/products/ai-machine-learning/adk-hackathon-results-winners-and-highlights) (Agent Development Kit Hackathon with Google Cloud 2025 (online), Latin America winner)

## Live

https://nyla-mvs.github.io/alpc/ (deployed from `main` by `.github/workflows/pages.yml`)

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # parser, engine and provider tests (28)
npm run build   # dist/index.html (single file) and dist/artifact.html
```

The app opens on a sample lecture plan (Grade 6 science, the solar system). The sample plan and its indicator codes are synthetic.

## How it works

1. **แผนเดิมและห้องเรียน.** Paste or open the old plan (.txt). `src/parse.ts` reads the topic, subject, grade, period length, indicator codes and steps, splits stage minutes across steps, and marks each step as teacher talk or student activity. The teacher confirms the class size and what the room has (projector, internet, student devices, space to move, printing).
2. **แผนใหม่.** Two ways to write it:
   - **Activity library** (`src/library.ts`, 18 activities, no key needed): `src/engine.ts` splits the period into ขั้นนำ / ขั้นสอน / ขั้นฝึก / ขั้นสรุป, picks the activity that fits each stage's minutes and the room's resources, and ties stages to indicators. Any stage can be swapped for another activity of the same stage.
   - **AI** (optional), with the teacher's own key, called straight from the browser. Keys stay in the browser and go only to the chosen provider. Model lists come from the teacher's account, so no model names go stale.
     | Provider | How the JSON is enforced |
     |---|---|
     | OpenAI | strict JSON schema (`response_format`) |
     | Claude (Anthropic) | official `@anthropic-ai/sdk` with `dangerouslyAllowBrowser`, `output_config.format` JSON schema; refusal fallbacks and `effort: medium` on models that support them; suggests `claude-opus-5-5` |
     | Google Gemini | `responseMimeType: application/json` + schema in the prompt |
     | OpenAI-compatible (Typhoon, OpenRouter, Groq, Ollama, any base URL) | `json_object`, retried without it if the service rejects the option; schema in the prompt |
     Every reply goes through `toPlan` (tolerates code fences and small slips) and then the same validator as library plans.
   Either way the plan goes through the same validator: total time equals the period, every stage has an indicator, every indicator has an activity and a rubric row, only resources the room has, activity time and group size fit, teacher talk at most half the period.
   The signature view compares one period before and after: minutes of teacher talk vs students doing.
   Export: Word (.doc in the standard Thai lesson-plan layout, TH Sarabun) or copy as text.
3. **บันทึกหลังสอน.** Mark each stage worked / ok / failed, tick "ไม่ทันเวลา", add a note. The next version swaps failed activities (never back to one that failed before), moves 5 minutes to stages that ran over, keeps what worked, and lists every change with the teacher's note as the reason.

## Brief from the idea bank

**Problem.** ครูถูกขอให้สอนแบบ Active Learning และต้องส่งแผนการสอนตามรูปแบบของโรงเรียน แต่แผนเดิมเป็นแบบบรรยาย และการเขียนแผนใหม่ทุกคาบใช้เวลามาก ครูจึงมักคัดลอกแผนสำเร็จรูปที่ไม่เข้ากับห้องเรียนจริง (หาตัวเลขอ้างอิงก่อน pitch)

**Users.** ครูประถมและมัธยม (หลัก) / ครูนิเทศและหัวหน้ากลุ่มสาระที่ตรวจแผน (รอง)

**Demo moment.** แผนบรรยายเรื่องระบบสุริยะ 2 หน้า กลายเป็นแผน active learning สำหรับห้อง 40 คนที่ไม่มีโปรเจกเตอร์ พร้อมใบงานและ rubric ในรูปแบบที่ส่งได้ทันที

**Weakness a judge will spot.** เครื่องมือเขียนแผนการสอนด้วย AI มีหลายตัวแล้ว กรรมการจะถามว่าดีกว่าการพิมพ์ถาม ChatGPT ตรงไหน

**Fixes.**
- จุดต่างคือบริบทจริง (ไม่มีโปรเจกเตอร์ 40 คน) + format ที่ส่งได้ทันที + validator ที่ตรวจความสอดคล้องกับตัวชี้วัด
- เพิ่ม feedback loop หลังสอนที่ทำให้แผนครั้งถัดไปดีขึ้น
- ให้ครูจริง 3 คนลองใช้และนำความเห็นมาแสดงใน pitch

**Proof to show.** คะแนนความเป็นไปได้จากครูจริง 3 คน + validator ไม่พบกิจกรรมที่ไม่ผูกตัวชี้วัด

**Combo.** combine with #251 PLC Log & วPA Portfolio — แผนและบันทึกหลังสอนกลายเป็นหลักฐานใน PLC log และแฟ้ม วPA

## Not built yet
- Learning a school's own Word template from an uploaded example (export uses the standard layout).
- Reading .docx/.pdf plans (paste text or open .txt for now).
- Curriculum indicator lookup; codes come from the plan or are typed in.

## Status
Built ahead of the Sea × OpenAI Codex Hackathon (Sat 21 Nov 2026), which likely bans pre-built code. Check the rules before submitting this code.
