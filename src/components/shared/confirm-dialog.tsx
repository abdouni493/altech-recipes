"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";

/**
 * Confirmation dialog. `onConfirm` may be async; the dialog stays open with a spinner until it resolves
 * and closes only when it does not return `false`.
 */
export function ConfirmDialog({
  trigger, title, description, confirmLabel, onConfirm, variant = "destructive", open, onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  variant?: "destructive" | "default";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("common");
  const [innerOpen, setInnerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;

  async function handle() {
    setBusy(true);
    try {
      const res = await onConfirm();
      if (res !== false) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !busy && setOpen(o)}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <div className="space-y-2">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button variant={variant} onClick={handle} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel ?? (variant === "destructive" ? t("delete") : t("confirm"))}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
