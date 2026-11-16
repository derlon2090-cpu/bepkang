"use client";
import { motion } from "framer-motion";
import type { VisualSolution } from "@/lib/ai/gemini-solver";

type Props = {
  imageSrc: string;
  /** Natural dimensions returned by Sharp. They lock the image and SVG to one coordinate plane. */
  width: number;
  height: number;
  steps: VisualSolution["steps"];
  activeStep: number;
  onSelectStep?: (step: number) => void;
};
const center = (box: { xmin: number; ymin: number; xmax: number; ymax: number }) => ({ x: (box.xmin + box.xmax) / 2, y: (box.ymin + box.ymax) / 2 });
export function VisualPuzzleCanvas({ imageSrc, width, height, steps, activeStep, onSelectStep }: Props) {
  const visible = steps.slice(0, activeStep);
  return <div className="canvas" style={{ aspectRatio: `${width} / ${height}` }}>
    <img src={imageSrc} width={width} height={height} alt="اللغز المرفوع" />
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="التوضيحات البصرية للحل">
      <defs>{[...new Set(steps.map((s) => s.color))].map((color) => <marker key={color} id={`arrow-${color.slice(1)}`} markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L0,8 L9,4 z" fill={color} /></marker>)}</defs>
      {visible.map((step, index) => {
        const fallback = step.box ? center(step.box) : { x: 500, y: 500 };
        const end = step.toPoint ?? fallback; const start = step.fromPoint ?? (step.box ? { x: step.box.xmin, y: step.box.ymin } : { x: 300, y: 300 });
        return <g key={`${step.stepNumber}-${index}`} onClick={() => onSelectStep?.(index + 1)}>
          {step.box && <motion.rect initial={{ opacity: 0 }} animate={{ opacity: 1 }} x={step.box.xmin} y={step.box.ymin} width={step.box.xmax - step.box.xmin} height={step.box.ymax - step.box.ymin} rx="12" fill={step.color} fillOpacity=".15" stroke={step.color} strokeWidth="6" vectorEffect="non-scaling-stroke" />}
          {step.annotationType === "CIRCLE" && <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ transformOrigin: `${end.x}px ${end.y}px` }} cx={end.x} cy={end.y} r="42" fill="none" stroke={step.color} strokeWidth="7" vectorEffect="non-scaling-stroke" />}
          {(step.annotationType === "ARROW" || step.annotationType === "PATH") && <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .55 }} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={step.color} strokeWidth="7" strokeLinecap="round" markerEnd={`url(#arrow-${step.color.slice(1)})`} vectorEffect="non-scaling-stroke" />}
          <circle cx={end.x} cy={end.y} r="26" fill={step.color} /><text x={end.x} y={end.y + 1} fill="white" textAnchor="middle" dominantBaseline="middle" fontSize="25" fontWeight="700">{step.stepNumber}</text>
        </g>;
      })}
    </svg>
  </div>;
}
