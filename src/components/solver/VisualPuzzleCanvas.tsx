"use client";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import type { VisualSolution } from "@/lib/ai/gemini-solver";

type Props = {
  imageSrc: string;
  /** Natural dimensions returned by Sharp. They lock the image and SVG to one coordinate plane. */
  width: number;
  height: number;
  steps: VisualSolution["steps"];
  selectedStep?: number;
  onSelectStep?: (step: number) => void;
};
const center = (box: { xmin: number; ymin: number; xmax: number; ymax: number }) => ({ x: (box.xmin + box.xmax) / 2, y: (box.ymin + box.ymax) / 2 });
export function VisualPuzzleCanvas({ imageSrc, width, height, steps, selectedStep, onSelectStep }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 1.5>(1);
  const setStep = useCallback((next: number) => { const clamped = Math.max(0, Math.min(next, steps.length)); setActiveStep(clamped); onSelectStep?.(clamped); }, [onSelectStep, steps.length]);
  useEffect(() => { setActiveStep(0); setPlaying(true); }, [steps]);
  useEffect(() => {
    if (selectedStep !== undefined && selectedStep !== activeStep) setActiveStep(Math.max(0, Math.min(selectedStep, steps.length)));
  }, [activeStep, selectedStep, steps.length]);
  useEffect(() => {
    if (!playing || activeStep >= steps.length) return;
    const timer = window.setTimeout(() => setStep(activeStep + 1), 1200 / speed);
    return () => window.clearTimeout(timer);
  }, [activeStep, playing, setStep, speed, steps.length]);
  const visible = steps.slice(0, activeStep);
  const currentStep = activeStep ? steps[activeStep - 1] : undefined;
  return <div className="player">
    <div className="canvas" style={{ aspectRatio: `${width} / ${height}` }}>
    <img src={imageSrc} width={width} height={height} alt="اللغز المرفوع" />
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="التوضيحات البصرية للحل">
      <defs>{[...new Set(steps.map((s) => s.color))].map((color) => <marker key={color} id={`arrow-${color.slice(1)}`} markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L9,4 z" fill={color} /></marker>)}</defs>
      {visible.map((step, index) => {
        const isCurrent = index === visible.length - 1;
        const fallback = step.box ? center(step.box) : { x: 500, y: 500 };
        const end = step.toPoint ?? fallback; const start = step.fromPoint ?? (step.box ? { x: step.box.xmin, y: step.box.ymin } : { x: 300, y: 300 });
        return <g key={`${step.stepNumber}-${index}`} opacity={isCurrent ? 1 : .3} className={isCurrent ? "active-annotation" : "ghost-annotation"} onClick={() => setStep(index + 1)}>
          {step.box && <motion.rect initial={isCurrent ? { opacity: 0 } : false} animate={isCurrent ? { opacity: 1, fillOpacity: [.15, .28, .15] } : { opacity: 1, fillOpacity: .15 }} transition={{ duration: .7 }} x={step.box.xmin} y={step.box.ymin} width={step.box.xmax - step.box.xmin} height={step.box.ymax - step.box.ymin} rx="12" fill={step.color} stroke={step.color} strokeWidth="6" vectorEffect="non-scaling-stroke" />}
          {step.annotationType === "CIRCLE" && <motion.circle initial={isCurrent ? { scale: 0, opacity: 0 } : false} animate={isCurrent ? { scale: [1, 1.18, 1], opacity: 1 } : { scale: 1, opacity: 1 }} transition={{ duration: .65, repeat: isCurrent ? Infinity : 0, repeatDelay: .5 }} style={{ transformOrigin: `${end.x}px ${end.y}px` }} cx={end.x} cy={end.y} r="42" fill="none" stroke={step.color} strokeWidth="7" vectorEffect="non-scaling-stroke" />}
          {(step.annotationType === "ARROW" || step.annotationType === "SWAP") && <motion.line initial={isCurrent ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: .55 }} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={step.color} strokeWidth="7" strokeLinecap="round" markerStart={step.annotationType === "SWAP" ? `url(#arrow-${step.color.slice(1)})` : undefined} markerEnd={`url(#arrow-${step.color.slice(1)})`} vectorEffect="non-scaling-stroke" />}
          {isCurrent && <g transform={`translate(${end.x + 34} ${end.y - 38})`}><rect x="0" y="0" width="112" height="40" rx="20" fill={step.color} /><text x="56" y="25" fill="white" textAnchor="middle" fontSize="18" fontWeight="700">{step.actionBadge} · {step.stepNumber}</text></g>}
          <motion.circle animate={isCurrent ? { r: [26, 31, 26] } : { r: 26 }} transition={{ duration: .8, repeat: isCurrent ? Infinity : 0 }} cx={end.x} cy={end.y} fill={step.color} /><text x={end.x} y={end.y + 1} fill="white" textAnchor="middle" dominantBaseline="middle" fontSize="25" fontWeight="700">{step.stepNumber}</text>
        </g>;
      })}
    </svg>
    </div>
    <div className="subtitle" aria-live="polite"><span>{currentStep ? `الخطوة ${currentStep.stepNumber}` : "الاستعداد"}</span><div><strong>{currentStep?.instruction ?? "يبدأ العرض تلقائيًا — شاهد العناصر التي يحددها الحل."}</strong>{currentStep && <small className="state-after-move">الحالة بعد الحركة: {currentStep.stateAfterMove}</small>}</div></div>
    <div className="player-controls">
      <button className="icon-btn" onClick={() => setPlaying(!playing)}>{playing ? "إيقاف" : "تشغيل"}</button>
      <button className="icon-btn" onClick={() => { setStep(0); setPlaying(true); }}>إعادة العرض</button>
      <button className="icon-btn" onClick={() => setSpeed(speed === 1 ? 1.5 : 1)}>{speed}×</button>
      <input className="timeline" aria-label="الانتقال بين خطوات الحل" type="range" min="0" max={steps.length} value={activeStep} onChange={(event) => { setPlaying(false); setStep(Number(event.target.value)); }} />
      <strong className="timeline-label">الخطوة {Math.max(activeStep, 1)} من {steps.length}</strong>
    </div>
  </div>;
}
