import { supabase } from './supabase';
import { optimizeImage } from './images';

const MEDIA_BUCKET = 'media';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export type MediaUploadOptions = {
  directory: string;
  file: File;
  maxDimension?: number;
  quality?: number;
  basename?: string;
};

function cleanSegment(value: string) {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}

export function assertImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Erlaubt sind JPEG, PNG, WebP und AVIF.');
  if (file.size <= 0) throw new Error('Die Bilddatei ist leer.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild darf maximal 8 MB groß sein.');
}

export function isOwnedMediaPath(path: string | null | undefined, directory: string) {
  if (!path) return false;
  const normalizedDirectory = directory.replace(/^\/+|\/+$/g, '');
  return path.startsWith(`${normalizedDirectory}/`) && !path.includes('..') && !path.startsWith('/');
}

export async function uploadImageToMedia(options: MediaUploadOptions) {
  assertImageFile(options.file);
  const directory = options.directory.replace(/^\/+|\/+$/g, '');
  if (!directory || directory.includes('..')) throw new Error('Ungültiger Medienpfad.');

  const image = await optimizeImage(options.file, options.maxDimension ?? 2200, options.quality ?? 0.84);
  const requestedBase = cleanSegment(options.basename || image.name.replace(/\.[^.]+$/, '')) || 'image';
  const path = `${directory}/${requestedBase}-${Date.now()}-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, image, {
    upsert: false,
    contentType: 'image/webp',
    cacheControl: '31536000',
  });
  if (error) throw error;
  return path;
}

/**
 * Upload first, persist the new DB reference second, and only then remove the old object.
 * If persisting fails, the new object is rolled back and the old reference remains untouched.
 */
export async function replaceMediaImage(options: MediaUploadOptions & {
  oldPath?: string | null;
  persistPath: (path: string) => Promise<{ error: { message?: string } | null }>;
}) {
  const path = await uploadImageToMedia(options);
  const saved = await options.persistPath(path);
  if (saved.error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error(saved.error.message || 'Bild konnte nicht zugeordnet werden.');
  }

  if (options.oldPath && options.oldPath !== path && isOwnedMediaPath(options.oldPath, options.directory)) {
    await supabase.storage.from(MEDIA_BUCKET).remove([options.oldPath]);
  }
  return path;
}

/** Clear the DB reference first. Delete only objects proven to belong to the expected directory. */
export async function removeMediaImage(options: {
  path?: string | null;
  directory: string;
  clearReference: () => Promise<{ error: { message?: string } | null }>;
}) {
  const cleared = await options.clearReference();
  if (cleared.error) throw new Error(cleared.error.message || 'Bildreferenz konnte nicht entfernt werden.');
  if (isOwnedMediaPath(options.path, options.directory)) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([options.path!]);
    if (error) throw error;
  }
}
