"use client";

export async function compressImage(file: File, maxDimension = 1280, maxBytes = 350 * 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d"); if (!context) throw new Error("تعذر تجهيز الصورة.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let quality = .82; let blob: Blob | null = null;
  while (quality >= .45) { blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)); if (blob && blob.size <= maxBytes) break; quality -= .09; }
  canvas.width = 0; canvas.height = 0;
  if (!blob) throw new Error("تعذر ضغط الصورة.");
  return new File([blob], "puzzle.jpg", { type: "image/jpeg" });
}
