"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const tiers = [["G3_4", "الصفوف 3–4 ابتدائي"], ["G5_6", "الصفوف 5–6 ابتدائي"], ["G7_8", "الصفوف 7–8 متوسط"], ["G9_10", "الصفوف 9–10 ثانوي"], ["G11_12", "الصفوف 11–12 ثانوي"]] as const;
type Question = { id: string; category: string; prompt: string; answer: string | null };
export default function TrainingPage() {
  const { track } = useParams<{ track: "bebras" | "kangaroo" }>(); const [ageGroup, setAgeGroup] = useState("G5_6"); const [questions, setQuestions] = useState<Question[]>([]); const [index, setIndex] = useState(0); const [answer, setAnswer] = useState(""); const [feedback, setFeedback] = useState("");
  useEffect(() => { setIndex(0); setFeedback(""); fetch(`/api/questions/adaptive?track=${track}&ageGroup=${ageGroup}`).then((r) => r.json()).then((data) => setQuestions(data.questions ?? [])); }, [track, ageGroup]);
  const question = questions[index]; const title = track === "bebras" ? "بيبراس: التفكير الحاسوبي" : "كانجارو: الرياضيات المنطقية";
  return <main className="shell"><nav className="nav"><Link className="brand" href="/">مدرّب <b>بيبراس وكانجارو</b></Link><span className="tag">تدريب تكيفي</span></nav><section className="hero"><h1>{title}</h1><p>نقدّم الفئات الأقل إتقانًا أولًا، ونتكيف مع إجاباتك مع كل جلسة.</p></section><div className="card panel"><h2>اختر مرحلتك الدراسية</h2><div className="controls">{tiers.map(([id, label]) => <button key={id} className={`btn ${ageGroup === id ? "" : "secondary"}`} onClick={() => setAgeGroup(id)}>{label}</button>)}</div>{question ? <section style={{ marginTop: 28 }}><span className="tag">{question.category}</span><h2 style={{ margin: "18px 0" }}>{question.prompt}</h2><input aria-label="إجابتك" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="اكتب إجابتك" style={{ width: "100%", padding: 12, border: "1px solid #dce2ef", borderRadius: 10 }} /><div className="controls"><button className="btn" onClick={() => setFeedback(answer.trim() === question.answer?.trim() ? "إجابة صحيحة، أحسنت!" : `الإجابة الصحيحة: ${question.answer}`)}>تحقق</button><button className="btn secondary" onClick={() => { setIndex(Math.min(index + 1, questions.length - 1)); setAnswer(""); setFeedback(""); }}>السؤال التالي</button></div>{feedback && <div className="answer">{feedback}</div>}</section> : <p style={{ color: "#69748d" }}>جارٍ تجهيز أسئلة تناسب مستواك…</p>}</div></main>;
}
