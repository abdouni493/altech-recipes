"use client";
// Small helpers to render react-hook-form fields with translated zod messages.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** zod messages are translation keys like "validation.required" or "validation.tooShort|3". */
export function useErrorText() {
  const t = useTranslations();
  return (message?: string) => {
    if (!message) return undefined;
    const [key, arg] = message.split("|");
    if (!key.includes(".")) return message;
    try {
      return t(key as never, { min: arg, max: arg } as never);
    } catch {
      return message;
    }
  };
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  const text = useErrorText()(message);
  if (!text) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {text}
    </p>
  );
}

export function Field({
  label, htmlFor, error, hint, children, className, optional, optionalLabel,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">({optionalLabel})</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} id={htmlFor ? `${htmlFor}-error` : undefined} />
    </div>
  );
}
