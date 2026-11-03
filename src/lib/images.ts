const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Erlaubt sind JPEG, PNG, WebP und AVIF.');
  if (file.size <= 0) throw new Error('Die Bilddatei ist leer.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild darf maximal 8 MB groß sein.');
}

export async function optimizeImage(file: File, maxDimension = 2200, quality = 0.84, targetBytes = 900 * 1024): Promise<File> {
  validateImageFile(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Das Bild konnte nicht verarbeitet werden.');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (level: number) => new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', level));
  let blob = await encode(quality);
  if (!blob) throw new Error('Das Bild konnte nicht in WebP umgewandelt werden.');

  // Optimize bandwidth at upload time. The Free storage plan cannot resize
  // published images on demand, so keep a reasonably sized original in media.
  for (let level = quality - 0.08; blob.size > targetBytes && level >= 0.60; level -= 0.08) {
    const smaller = await encode(level);
    if (!smaller) break;
    blob = smaller;
  }

  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
  return new File([blob], `${safeBase || 'image'}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}
