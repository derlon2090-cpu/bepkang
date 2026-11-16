import sharp from "sharp";

const MAX_WIDTH = 1200;
const MAX_BYTES = 8 * 1024 * 1024;
export type NormalizedImage = { base64: string; mimeType: "image/webp"; width: number; height: number; buffer: Buffer };

/** Removes EXIF orientation surprises and outputs a compact, model-friendly WebP image. */
export async function normalizePuzzleImage(input: Buffer): Promise<NormalizedImage> {
  if (!input.length || input.length > MAX_BYTES) throw new Error("يجب أن يكون حجم الصورة بين 1 بايت و8 ميغابايت.");
  const image = sharp(input, { limitInputPixels: 40_000_000 }).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const { data, info } = await image.webp({ quality: 88, effort: 4 }).toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error("تعذر قراءة أبعاد الصورة.");
  return { base64: data.toString("base64"), mimeType: "image/webp", width: info.width, height: info.height, buffer: data };
}
