"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { key: string; title: string; hint?: string };

/** Horizontal step indicator. Completed steps are clickable. */
export function Stepper({ steps, current, onStepClick, maxReached }: { steps: Step[]; current: number; onStepClick?: (i: number) => void; maxReached: number }) {
  return (
    <ol className="flex w-full items-start gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onStepClick && i <= maxReached && i !== current;
        return (
          <li key={s.key} className="flex min-w-[7.5rem] flex-1 items-start gap-2">
            <button type="button" disabled={!clickable} onClick={() => clickable && onStepClick?.(i)} aria-current={active ? "step" : undefined}
              className={cn("group flex w-full flex-col gap-2 text-start disabled:cursor-default", clickable && "cursor-pointer")}>
              <span className={cn("h-1 w-full rounded-full transition-colors duration-500", done || active ? "bg-primary" : "bg-border")} />
              <span className="flex items-center gap-2">
                <span className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-all",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-sage-soft text-primary ring-4 ring-primary/10",
                  !done && !active && "bg-card text-muted-foreground"
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-medium", !active && !done && "text-muted-foreground", clickable && "group-hover:text-primary")}>{s.title}</span>
                  {s.hint && <span className="hidden truncate text-xs text-muted-foreground md:block">{s.hint}</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
