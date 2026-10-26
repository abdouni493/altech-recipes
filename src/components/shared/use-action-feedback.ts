"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/validators";

/** Translate an action error key (e.g. "products.inUse") with its meta values and show it as a toast. */
export function useActionFeedback() {
  const t = useTranslations();
  function message(key: string, values?: Record<string, string | number>) {
    try {
      return t(key as never, values as never);
    } catch {
      return t("common.genericError");
    }
  }
  return {
    message,
    error(result: Extract<ActionResult<unknown>, { ok: false }>) {
      toast.error(message(result.error, result.meta));
    },
  };
}
