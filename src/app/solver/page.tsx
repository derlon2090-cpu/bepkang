"use client";
import { useState } from "react";
import { ImageUploader } from "@/components/solver/ImageUploader";
import { SolutionModes } from "@/components/solver/SolutionModes";
import { VisualPuzzleCanvas } from "@/components/solver/VisualPuzzleCanvas";
import type { VisualSolution } from "@/lib/ai/gemini-solver";

type Result = { image: { base64: string; mimeType: string; width: number; height: number }; solution: VisualSolution };
export default function SolverPage() {
  const [result, setResult] = useState<Result>(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [step, setStep] = useState(0);
  async function upload(file: File) { setBusy(true); setError(""); setResult(undefined); setStep(0); try { const data = new FormData(); data.append("image", file); const response = await fetch("/api/solve", { method: "POST", body: data }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setResult(payload); } catch (e) { setError(e instanceof Error ? e.message : "تعذر رفع الصورة."); } finally { setBusy(false); } }
  const imageSrc = result ? `data:${result.image.mimeType};base64,${result.image.base64}` : "";
  return <main className="shell"><nav className="nav"><a className="brand" href="/">مدرّب <b>بيبراس وكانجارو</b></a><span className="tag">المحلّل البصري</span></nav><section className="hero"><h1>الحل فوق اللغز نفسه.</h1><p>ارفع سؤالًا وسنحوّل الفكرة إلى خطوات وأسهم مرئية، مع تلميحات تترك لك متعة الوصول للإجابة.</p></section><div className="workspace"><section className="card panel"><ImageUploader onImage={upload} busy={busy} />{error && <div className="error">{error}</div>}{result && <><div className="preview"><VisualPuzzleCanvas imageSrc={imageSrc} width={result.image.width} height={result.image.height} steps={result.solution.steps} activeStep={step} onSelectStep={setStep} /></div><p className="step-label">خطوة {step} من {result.solution.steps.length}</p><div className="controls"><button className="btn secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>الخطوة السابقة</button><button className="btn" disabled={step === result.solution.steps.length} onClick={() => setStep(step + 1)}>الخطوة التالية</button><button className="btn secondary" onClick={() => setStep(result.solution.steps.length)}>عرض الكل</button></div></>}</section><aside className="card panel">{result ? <SolutionModes solution={result.solution} onStep={setStep} /> : <><h2 style={{ marginTop: 0 }}>كيف يعمل؟</h2><p style={{ color: "#69748d", lineHeight: 1.8 }}>نصحّح اتجاه الصورة ونضغطها، ثم يحدد Gemini العناصر بإحداثيات دقيقة. بعدها تُرسم طبقة SVG متجاوبة فوقها دون إعادة رسم اللغز.</p></>}</aside></div></main>;
}
