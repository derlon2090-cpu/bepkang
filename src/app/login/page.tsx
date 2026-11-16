"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

const messages: Record<string, string> = { "invalid-code": "الكود غير صحيح.", "expired-code": "انتهت صلاحية هذا الكود.", "inactive-code": "تم إيقاف هذا الكود.", "code-exhausted": "اكتمل عدد استخدامات هذا الكود.", unavailable: "خدمة الدخول غير متاحة مؤقتًا." };

export default function LoginPage() {
  const [code, setCode] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (!code.trim()) { setMessage("أدخل كود الدخول الخاص."); return; }
    setBusy(true); const result = await signIn("credentials", { code, redirect: false }); setBusy(false);
    if (result?.error) { setMessage(messages[result.code ?? ""] ?? "الكود غير صحيح أو منتهي الصلاحية."); return; }
    window.location.assign("/");
  }
  return <main className="shell"><section className="card panel" style={{ maxWidth: 460, margin: "60px auto" }}>
    <span className="tag">مساحتك التعليمية الخاصة</span><h1>تسجيل الدخول بكود خاص</h1><p style={{ color: "#69748d", lineHeight: 1.8 }}>أدخل الكود الذي أرسله لك المعلّم. سيُحفظ تقدمك على هذا الحساب.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}><label htmlFor="code">كود الدخول الخاص</label><input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BEBRAS-7421" autoCapitalize="characters" autoComplete="off" spellCheck={false} dir="ltr" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: ".06em" }} /><button className="btn" disabled={busy} type="submit">{busy ? "جارٍ التحقق…" : "دخول"}</button></form>
    {message && <p className="error" role="alert">{message}</p>}
  </section></main>;
}
