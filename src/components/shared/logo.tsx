import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ name, logoUrl, href = "/", className }: { name: string; logoUrl?: string | null; href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:rotate-12">
          <Leaf className="h-5 w-5" />
        </span>
      )}
      <span className="font-serif text-lg font-semibold tracking-tight">{name}</span>
    </Link>
  );
}
