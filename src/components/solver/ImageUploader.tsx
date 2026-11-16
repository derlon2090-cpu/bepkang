"use client";
import { useRef, useState } from "react";
type Props = { onImage: (file: File) => void; busy?: boolean };
export function ImageUploader({ onImage, busy }: Props) {
  const [dragging, setDragging] = useState(false); const input = useRef<HTMLInputElement>(null);
  const accept = (file?: File) => { if (file?.type.startsWith("image/")) onImage(file); };
  return <div className={`uploader ${dragging ? "active" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); accept(e.dataTransfer.files[0]); }}>
    <div aria-hidden="true" style={{ fontSize: 30 }}>⌁</div><h2>ارفع صورة اللغز</h2><p>اسحب الصورة هنا، أو التقطها بالكاميرا. تُعالج الصورة بأمان قبل التحليل.</p>
    <label className="file-btn">{busy ? "جارٍ التحليل…" : "اختيار صورة"}<input ref={input} type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => accept(e.target.files?.[0])} /></label>
  </div>;
}
