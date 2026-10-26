// Client-side image compression before upload (browser-image-compression, runs in a Web Worker).

export type ImagePreset = "product" | "offer" | "hero" | "logo" | "carrier" | "favicon" | "default";

/** Max edge in px / target weight in MB. */
export const IMAGE_PRESETS: Record<ImagePreset, { maxWidthOrHeight: number; maxSizeMB: number }> = {
  product: { maxWidthOrHeight: 1080, maxSizeMB: 150 / 1024 },
  offer: { maxWidthOrHeight: 1200, maxSizeMB: 200 / 1024 },
  hero: { maxWidthOrHeight: 1920, maxSizeMB: 350 / 1024 },
  logo: { maxWidthOrHeight: 512, maxSizeMB: 120 / 1024 },
  carrier: { maxWidthOrHeight: 320, maxSizeMB: 60 / 1024 },
  favicon: { maxWidthOrHeight: 256, maxSizeMB: 40 / 1024 },
  default: { maxWidthOrHeight: 1280, maxSizeMB: 400 / 1024 },
};

const SKIP_BELOW_BYTES = 60 * 1024;
const PASSTHROUGH_TYPES = ["image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

let webpSupport: boolean | undefined;

/** True when this browser can encode WebP from a canvas. */
function canEncodeWebp() {
  if (webpSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

function renamed(file: Blob, originalName: string, type: string) {
  const ext = type === "image/webp" ? "webp" : "jpg";
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([file], `${base}.${ext}`, { type, lastModified: Date.now() });
}

/**
 * Compress an image to WebP (or JPEG when WebP encoding is unavailable).
 * SVG / ICO and files under 60 KB are kept as they are; on any failure, or if the result
 * would be bigger, the original file is returned.
 */
export async function compressImageFile(
  file: File,
  { preset = "default", onProgress }: { preset?: ImagePreset; onProgress?: (percent: number) => void } = {},
): Promise<File> {
  if (PASSTHROUGH_TYPES.includes(file.type) || /\.(svg|ico)$/i.test(file.name) || file.size < SKIP_BELOW_BYTES) {
    onProgress?.(100);
    return file;
  }
  const { maxSizeMB, maxWidthOrHeight } = IMAGE_PRESETS[preset];
  const fileType = canEncodeWebp() ? "image/webp" : "image/jpeg";
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const output = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      initialQuality: 0.75,
      useWebWorker: true,
      alwaysKeepResolution: false,
      fileType,
      onProgress,
    });
    if (output.size >= file.size) return file;
    return renamed(output, file.name, fileType);
  } catch (e) {
    // HEIC, worker error, unsupported format…: upload the original.
    console.warn("Image compression skipped:", e);
    return file;
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
