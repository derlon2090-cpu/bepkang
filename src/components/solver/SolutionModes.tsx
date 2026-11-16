"use client";
import { useState } from "react";
import type { VisualSolution } from "@/lib/ai/gemini-solver";
type Mode = "coach" | "visual" | "steps";
export function SolutionModes({ solution, onStep }: { solution: VisualSolution; onStep: (step: number) => void }) {
  const [mode, setMode] = useState<Mode>("coach"); const [hint, setHint] = useState(0);
  return <><div className="modes">{([ ["coach", "علّمني كيف أحل"], ["visual", "حل بالصورة"], ["steps", "خطوة بخطوة"] ] as const).map(([id, label]) => <button key={id} className={`mode ${mode === id ? "selected" : ""}`} onClick={() => setMode(id)}>{label}</button>)}</div>
  <div className="mode-content">{mode === "coach" && <><h2>فكّر معي</h2><p>حاول الإجابة عن التلميح قبل كشف الذي يليه.</p><div className="hint">{solution.socraticHints[hint]}</div><div className="controls"><button className="btn secondary" disabled={hint === 0} onClick={() => setHint(hint - 1)}>السابق</button><button className="btn" disabled={hint === 2} onClick={() => setHint(hint + 1)}>التلميح التالي</button></div></>}
  {mode === "visual" && <><h2>مسار الحل البصري</h2><p>استخدم أزرار الخطوات أسفل الصورة لمتابعة الأسهم والعلامات فوق اللغز.</p></>}
  {mode === "steps" && <><h2>الشرح المفصل</h2><ol className="steps">{solution.steps.map((s, i) => <li key={s.stepNumber} onMouseEnter={() => onStep(i + 1)} onClick={() => onStep(i + 1)}><span className="num">{s.stepNumber}</span><span>{s.instruction}</span></li>)}</ol><div className="answer"><b>الإجابة:</b> {solution.finalAnswer}<br />{solution.verificationExplanation}</div></>}</div></>;
}
