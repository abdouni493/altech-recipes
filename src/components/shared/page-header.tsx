import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TextReveal } from "./motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, backHref, backLabel, className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {backHref && (
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4 flip-rtl" />
            {backLabel}
          </Link>
        )}
        {typeof title === "string"
          ? <TextReveal as="h1" inView={false} text={title} className="block font-serif text-2xl font-bold sm:text-4xl" />
          : <h1 className="font-serif text-2xl font-bold sm:text-4xl">{title}</h1>}
        <span aria-hidden className="block h-1 w-12 origin-left animate-in slide-in-from-left-4 fade-in bg-lemon duration-700 rtl:origin-right" />
        {description && <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed bg-cream px-6 py-14 text-center", className)}>
      <div className="relative mb-1">
        <div className="absolute inset-0 -z-0 scale-150 rounded-full bg-accent/60 blur-xl" />
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground [&_svg]:h-7 [&_svg]:w-7">{icon}</div>
      </div>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
