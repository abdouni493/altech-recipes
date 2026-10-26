"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { uploadImage, type ImageBucket } from "@/lib/imageUpload";
import { formatBytes, type ImagePreset } from "@/utils/media";
import { cn } from "@/lib/utils";

// Originals up to 20 MB are accepted: they are compressed in the browser before upload.
const MAX = 20 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
const ACCEPT = ".jpg,.jpeg,.png,.webp,.svg,.ico," + TYPES.join(",");

/** Compresses an image, uploads it to Supabase Storage and returns its public URL. Shows a local preview immediately. */
export function ImageUpload({
  value, onChange, bucket, folder, preset = "default", className, aspect = "aspect-[4/3]", id, compact = false,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  bucket: ImageBucket;
  folder?: string;
  preset?: ImagePreset;
  className?: string;
  aspect?: string;
  id?: string;
  compact?: boolean;
}) {
  const t = useTranslations("common.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) return setError(t("badType"));
    if (file.size > MAX) return setError(t("tooLarge"));
    const local = URL.createObjectURL(file);
    setPreview(local);
    setBusy(true);
    setProgress(0);
    try {
      const res = await uploadImage(file, { bucket, folder: folder ?? preset, preset, onProgress: setProgress });
      onChange(res.url);
      const saved = res.originalSize > 0 ? Math.round((1 - res.size / res.originalSize) * 100) : 0;
      toast.success(saved > 0
        ? `${formatBytes(res.originalSize)} → ${formatBytes(res.size)} (−${saved}%)`
        : t("uploaded", { size: formatBytes(res.size) }));
    } catch (e) {
      console.error(e);
      setError(`${t("failed")}${e instanceof Error && e.message ? ` (${e.message})` : ""}`);
      setPreview(null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(local);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shown = preview ?? value ?? null;

  return (
    <div className={cn("space-y-2", className)}>
      <input ref={inputRef} id={id} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      {shown ? (
        <div className={cn("group relative overflow-hidden rounded-xl border bg-muted", compact ? "h-28 w-28" : aspect)}>
          <img src={shown} alt="" className="h-full w-full object-cover" />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 px-3 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <Progress value={progress} className="h-1.5 w-full max-w-[12rem]" aria-label={t("uploading")} />
            </div>
          )}
          {!busy && (
            <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Button type="button" size="icon-sm" variant="secondary" onClick={() => inputRef.current?.click()} aria-label={t("change")} title={t("change")}>
                <RefreshCw />
              </Button>
              <Button type="button" size="icon-sm" variant="destructive" onClick={() => onChange(null)} aria-label={t("remove")} title={t("remove")}>
                <Trash2 />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card/60 p-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-sage-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "h-28 w-28" : aspect,
            dragging && "border-primary bg-sage-soft/50"
          )}
        >
          <ImagePlus className="h-7 w-7 text-primary" />
          {!compact && <span className="font-medium text-foreground">{t("choose")}</span>}
          {!compact && <span className="text-xs">{t("drop")}</span>}
        </button>
      )}
      {!compact && <p className="text-xs text-muted-foreground">{t("hint")}</p>}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
