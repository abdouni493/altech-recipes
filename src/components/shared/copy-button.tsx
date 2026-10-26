"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label, showLabel = false, ...props }: { text: string; label?: string; showLabel?: boolean } & ButtonProps) {
  const t = useTranslations("common");
  const [done, setDone] = useState(false);
  return (
    <Button type="button" variant="outline" size={showLabel ? "sm" : "icon"} aria-label={label ?? t("copy")} title={label ?? t("copy")}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          toast.success(t("copied"));
          setTimeout(() => setDone(false), 1500);
        }
      }}
      {...props}>
      {done ? <Check className="text-success" /> : <Copy />}
      {showLabel && (label ?? t("copy"))}
    </Button>
  );
}
