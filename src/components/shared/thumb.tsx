import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Thumb({ src, alt = "", className }: { src?: string | null; alt?: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} loading="lazy" className={cn("h-11 w-11 shrink-0 rounded-lg border object-cover", className)} />
  ) : (
    <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground", className)} aria-hidden>
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}
