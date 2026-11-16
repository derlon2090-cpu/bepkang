"use client";

import { useState } from "react";
import { ImageUploader } from "@/components/solver/ImageUploader";
import { SolutionModes } from "@/components/solver/SolutionModes";
import { VisualPuzzleCanvas } from "@/components/solver/VisualPuzzleCanvas";
import type { VisualSolution } from "@/lib/ai/gemini-solver";

type Result = { image: { base64: string; mimeType: string; width: number; height: number }; solution: VisualSolution };

export default function SolverPage() {
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  async function upload(file: File) {
    setBusy(true); setError(""); setResult(undefined); setStep(0);
    try {
      const data = new FormData(); data.append("image", file);
      const response = await fetch("/api/solve", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع الصورة.");
    } finally { setBusy(false); }
  }

  const imageSrc = result ? `data:${result.image.mimeType};base64,${result.image.base64}` : "";
  return <main className="shell">
    <nav className="nav"><a className="brand" href="/solver">بِبراس <b>× كانجارو</b></a><div className="nav-links"><a className="active" href="/solver">المحلل البصري الفوري</a><a href="/admin/train-model">تدريب النموذج</a><a href="/admin/codes">أكواد الدخول</a></div></nav>
    <section className="hero solver-hero"><span className="eyebrow">جاهز للاختبار · حل بصري سريع</span><h1>الصق السؤال. شاهد الحل يتحرك فوقه.</h1><p>لقطة شاشة واحدة تكفي: نفهم اللغز ونبني لك عرضًا مرئيًا قصيرًا، خطوة بخطوة.</p></section>
    <div className="workspace">
      <section className="card panel">
        {result && <div className="final-answer"><span>الإجابة النهائية</span><strong>{result.solution.finalAnswer}</strong><p>{result.solution.verificationExplanation}</p></div>}
        <ImageUploader onImage={upload} busy={busy} />
        {error && <div className="error">{error}</div>}
        {result && <div className="preview"><VisualPuzzleCanvas imageSrc={imageSrc} width={result.image.width} height={result.image.height} steps={result.solution.steps} selectedStep={step} onSelectStep={setStep} /></div>}
      </section>
      <aside className="card panel">
        {result ? <>
          <section className="constraints-card" aria-label="تقرير التحقق من شروط اللغز">
            <span className="eyebrow">تم التحقق</span><h2>تقرير التحقق من شروط اللغز</h2>
            <ul>{result.solution.constraintsVerification.map((check, index) => <li key={`${check.rule}-${index}`}><span className="verified-check" aria-hidden="true">✓</span><div><b>{check.rule}</b><p>{check.proof}</p></div></li>)}</ul>
          </section>
          <SolutionModes solution={result.solution} onStep={setStep} />
        </> : <>
          <span className="eyebrow">مسار من لقطة إلى إجابة</span><h2 style={{ marginTop: 10 }}>مصمم للحظات الاختبار.</h2><p style={{ color: "#aab7c9", lineHeight: 1.8 }}>الصق مباشرة بـ Ctrl + V، أو اسحب الصورة، أو التقطها بالكاميرا. نضبط الصورة ثم نرسم طبقة حل متزامنة فوقها.</p><div className="speed-note"><b>أقل من خطوة واحدة</b><span>التقط ← الصق ← شاهد الحل</span></div>
        </>}
      </aside>
    </div>
  </main>;
}
