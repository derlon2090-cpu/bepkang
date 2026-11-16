import sharp from "sharp";

const MAX_WIDTH = 1200;
const MAX_BYTES = 8 * 1024 * 1024;
const GRID_SIZE = 10;
export type AnalysisImage = { base64: string; mimeType: "image/webp"; buffer: Buffer };
export type NormalizedImage = {
  base64: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  /** Clean WebP used for caching and shown back to the learner. */
  buffer: Buffer;
  /** A private calibration copy sent only to the model. */
  analysisImage: AnalysisImage;
};

/**
 * Adds a deliberately subtle 10 × 10 A1–J10 reference grid for spatial
 * grounding. This buffer must never be returned to the browser.
 */
export async function createGriddedAnalysisBuffer(originalBuffer: Buffer): Promise<AnalysisImage> {
  const source = sharp(originalBuffer);
  const metadata = await source.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) throw new Error("تعذر إنشاء شبكة معايرة للصورة.");

  const cellWidth = width / GRID_SIZE;
  const cellHeight = height / GRID_SIZE;
  const lines = Array.from({ length: GRID_SIZE - 1 }, (_, index) => {
    const offset = index + 1;
    const x = Math.round(offset * cellWidth);
    const y = Math.round(offset * cellHeight);
    return `<path d="M ${x} 0 V ${height} M 0 ${y} H ${width}" />`;
  }).join("");
  const columns = Array.from({ length: GRID_SIZE }, (_, index) => `<text x="${Math.round((index + 0.5) * cellWidth)}" y="18" text-anchor="middle">${String.fromCharCode(65 + index)}</text>`).join("");
  const rows = Array.from({ length: GRID_SIZE }, (_, index) => `<text x="5" y="${Math.round((index + 0.5) * cellHeight) + 5}">${index + 1}</text>`).join("");
  const overlay = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><g stroke="#0f4c81" stroke-width="1" opacity=".34">${lines}</g><g fill="#0f4c81" font-family="Arial,sans-serif" font-size="14" font-weight="700" stroke="white" stroke-width="2" paint-order="stroke" opacity=".78">${columns}${rows}</g></svg>`);
  const data = await sharp(originalBuffer).composite([{ input: overlay, top: 0, left: 0 }]).webp({ quality: 88, effort: 4 }).toBuffer();
  return { base64: data.toString("base64"), mimeType: "image/webp", buffer: data };
}

/** Removes EXIF orientation surprises and outputs a compact, model-friendly WebP image. */
export async function normalizePuzzleImage(input: Buffer): Promise<NormalizedImage> {
  if (!input.length || input.length > MAX_BYTES) throw new Error("يجب أن يكون حجم الصورة بين 1 بايت و8 ميغابايت.");
  const image = sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const { data, info } = await image.webp({ quality: 88, effort: 4 }).toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error("تعذر قراءة أبعاد الصورة.");
  const analysisImage = await createGriddedAnalysisBuffer(data);
  return { base64: data.toString("base64"), mimeType: "image/webp", width: info.width, height: info.height, buffer: data, analysisImage };
}
