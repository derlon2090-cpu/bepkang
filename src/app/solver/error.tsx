"use client";
export default function SolverError({ error, reset }: { error: Error; reset: () => void }) {
  return <main className="chat-workspace"><section className="error"><p>تعذر عرض مساحة الحل: {error.message}</p><button onClick={reset}>إعادة المحاولة</button></section></main>;
}
