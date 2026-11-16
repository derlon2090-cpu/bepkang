"use client";

import { useState } from "react";
import { saveReferenceExample } from "./actions";

const starter = JSON.stringify({ competition: "BEBRAS", category: "", problemSummary: "", socraticHints: ["", "", ""], steps: [{ stepNumber: 1, instruction: "", annotationType: "CIRCLE", toPoint: { x: 500, y: 500 }, color: "#10b981" }], finalAnswer: "", verificationExplanation: "" }, null, 2);

export function TrainingForm() {
  const [preview, setPreview] = useState<string>();
  return <form action={saveReferenceExample} className="training-form">
    <div className="form-grid"><label>المسابقة<select name="competition" defaultValue="BEBRAS"><option value="BEBRAS">Bebras</option><option value="KANGAROO">Kangaroo</option></select></label><label>الفئة / المهارة<input name="category" required maxLength={120} placeholder="مثال: التفكير المنطقي" /></label></div>
    <label className="image-drop">صورة اللغز المرجعي<input name="image" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} />{preview ? <img src={preview} alt="معاينة اللغز المرجعي" /> : <span>أضف لقطة أو صورة للسؤال السابق</span>}</label>
    <label>وصف نمط اللغز<textarea name="pattern" required rows={3} placeholder="ما الإشارة التي تساعد Gemini على تمييز هذا النوع من الألغاز؟" /></label>
    <label>استراتيجية الحل الموثّقة<textarea name="strategy" required rows={4} placeholder="اكتب قواعد التفكير والخطوات التي تريد للنموذج محاكاتها." /></label>
    <label>خطوات الحل المراجَعة (JSON)<textarea name="verifiedSteps" required rows={14} defaultValue={starter} dir="ltr" spellCheck={false} /></label>
    <button className="btn" type="submit">حفظ كمثال تدريب موثّق</button>
  </form>;
}
