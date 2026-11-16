"use client";
import { useEffect, useRef, useState } from "react";
type Props = { onImage: (file: File) => void; busy?: boolean };
export function ImageUploader({ onImage, busy }: Props) {
  const [dragging, setDragging] = useState(false); const input = useRef<HTMLInputElement>(null);
  const accept = (file?: File) => { if (file?.type.startsWith("image/")) onImage(file); };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));
      if (image && !busy) { event.preventDefault(); accept(image); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [busy]);
  return <div className={`uploader ${dragging ? "active" : ""} ${busy ? "scanning" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }}>
    <div aria-hidden="true" style={{ fontSize: 30 }}>⌁</div><h2>{busy ? "جارٍ مسح اللغز…" : "الصق لقطة الشاشة واحصل على الحل"}</h2><p>{busy ? "Gemini يحدد العناصر والمسار البصري الآن." : "اضغط Ctrl + V في أي مكان، أو اسحب الصورة، أو التقطها بالكاميرا."}</p>
    <label className="file-btn">{busy ? "جارٍ التحليل…" : "اختيار صورة"}<input ref={input} type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => accept(e.target.files?.[0])} /></label>
  </div>;
}
