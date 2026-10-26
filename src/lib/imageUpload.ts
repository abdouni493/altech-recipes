// Upload images to Supabase Storage (public buckets created by supabase/schema.sql, section 7).
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { compressImageFile, type ImagePreset } from "@/utils/media";

export type ImageBucket = "products" | "recipes" | "packs" | "site";

export type UploadResult = { url: string; path: string; originalSize: number; size: number };

type Options = { bucket: ImageBucket; folder?: string; preset?: ImagePreset; onProgress?: (percent: number) => void };

const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/svg+xml": "svg",
  "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico",
};

function uniqueName(folder: string, file: File) {
  const ext = EXT_BY_TYPE[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const random = Math.random().toString(36).slice(2, 10);
  return `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${random}.${ext}`;
}

/**
 * Compress, then upload to Supabase Storage under a never-reused name (so it can be cached for a year).
 * Returns the public URL. Throws on failure — the caller shows the error (no data-URL fallback).
 * Progress: 0–70 % compression, 70–100 % upload.
 */
export async function uploadImage(file: File, { bucket, folder = "uploads", preset = "default", onProgress }: Options): Promise<UploadResult> {
  const compressed = await compressImageFile(file, { preset, onProgress: (p) => onProgress?.(Math.round(p * 0.7)) });
  onProgress?.(70);
  const path = uniqueName(folder, compressed);
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    upsert: false,
    cacheControl: "31536000",
    contentType: compressed.type || undefined,
  });
  if (error) throw new Error(error.message);
  onProgress?.(100);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, originalSize: file.size, size: compressed.size };
}

/** Uploads several files in order with one shared progress bar. */
export async function uploadImages(files: File[], options: Options): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const [i, file] of files.entries()) {
    results.push(await uploadImage(file, {
      ...options,
      onProgress: (p) => options.onProgress?.(Math.round(((i + p / 100) / files.length) * 100)),
    }));
  }
  return results;
}
