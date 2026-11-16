"use client";
import { useEffect } from "react";
export default function SolverError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("Solver Error Details:", error, error?.stack); }, [error]);
  return <main className="chat-workspace"><section className="error"><p>تعذر عرض مساحة الحل: {error.message}</p><button onClick={reset}>إعادة المحاولة</button></section></main>;
}
