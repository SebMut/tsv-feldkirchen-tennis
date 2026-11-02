import { supabase } from './supabase';
import { optimizeImage, validateImageFile } from './images';

const MEDIA_BUCKET = 'media';

export type MediaUploadOptions = {
  directory: string;
  file: File;
  maxDimension?: number;
  quality?: number;
  basename?: string;
};

type DbResult = { error: { message?: string } | null };

function cleanSegment(value: string) {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}

function normalizeDirectory(directory: string) {
  const normalized = directory.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) throw new Error('Ungültiger Medienpfad.');
  return normalized;
}

export const assertImageFile = validateImageFile;

export function isOwnedMediaPath(path: string | null | undefined, directory: string) {
  if (!path) return false;
  const normalizedDirectory = normalizeDirectory(directory);
  return path.startsWith(`${normalizedDirectory}/`) && !path.includes('..') && !path.startsWith('/');
}

export async function uploadImageToMedia(options: MediaUploadOptions) {
  validateImageFile(options.file);
  const directory = normalizeDirectory(options.directory);
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

async function removeUploadedPath(path: string) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.error('Media rollback failed', { path, message: error.message });
}

/** Upload -> DB reference -> old object cleanup. Failed DB writes roll the new object back. */
export async function replaceMediaImage(options: MediaUploadOptions & {
  oldPath?: string | null;
  persistPath: (path: string) => Promise<DbResult>;
}) {
  const path = await uploadImageToMedia(options);
  let saved: DbResult;
  try {
    saved = await options.persistPath(path);
  } catch (error) {
    await removeUploadedPath(path);
    throw error;
  }
  if (saved.error) {
    await removeUploadedPath(path);
    throw new Error(saved.error.message || 'Bild konnte nicht zugeordnet werden.');
  }

  if (options.oldPath && options.oldPath !== path && isOwnedMediaPath(options.oldPath, options.directory)) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([options.oldPath]);
    if (error) console.error('Old media cleanup failed', { path: options.oldPath, message: error.message });
  }
  return path;
}

/** Clear the DB reference first; storage deletion is restricted to the owning directory. */
export async function removeMediaImage(options: {
  path?: string | null;
  directory: string;
  clearReference: () => Promise<DbResult>;
}) {
  const cleared = await options.clearReference();
  if (cleared.error) throw new Error(cleared.error.message || 'Bildreferenz konnte nicht entfernt werden.');
  if (isOwnedMediaPath(options.path, options.directory)) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([options.path!]);
    if (error) throw error;
  }
}

/**
 * Safely creates a gallery: every uploaded object is tracked. If optimization,
 * upload or the gallery_items insert fails, uploaded objects and created rows
 * are removed before the error is re-thrown.
 */
export async function uploadGalleryImages(options: {
  directory: string;
  files: File[];
  persistItem: (path: string, index: number) => Promise<DbResult>;
  rollbackItems: () => Promise<DbResult>;
  maxDimension?: number;
  quality?: number;
  basename?: string;
}) {
  const uploaded: string[] = [];
  try {
    for (const [index, file] of options.files.entries()) {
      const path = await uploadImageToMedia({
        directory: options.directory,
        file,
        maxDimension: options.maxDimension ?? 1800,
        quality: options.quality ?? 0.82,
        basename: `${options.basename || 'gallery'}-${index + 1}`,
      });
      uploaded.push(path);
      const saved = await options.persistItem(path, index);
      if (saved.error) throw new Error(saved.error.message || 'Galeriebild konnte nicht zugeordnet werden.');
    }
    return uploaded;
  } catch (error) {
    const rollback = await options.rollbackItems();
    if (rollback.error) console.error('Gallery row rollback failed', rollback.error.message);
    if (uploaded.length) {
      const removed = await supabase.storage.from(MEDIA_BUCKET).remove(uploaded);
      if (removed.error) console.error('Gallery storage rollback failed', removed.error.message);
    }
    throw error;
  }
}

/** Delete DB rows first and storage only after the DB operation succeeded. */
export async function removeOwnedMediaPaths(options: {
  paths: Array<string | null | undefined>;
  directory: string;
  clearReferences: () => Promise<DbResult>;
}) {
  const ownedPaths = options.paths.filter((path): path is string => isOwnedMediaPath(path, options.directory));
  const cleared = await options.clearReferences();
  if (cleared.error) throw new Error(cleared.error.message || 'Bildreferenzen konnten nicht entfernt werden.');
  if (!ownedPaths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(ownedPaths);
  if (error) throw error;
}
