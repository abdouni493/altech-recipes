"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { History, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/basic";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deleteHistoryAction } from "@/actions/portal";

type Row = { id: string; recipeId: string; recipeName: string; imageUrl: string | null; target: string; href: string; date: string };

export function HistoryList({ rows }: { rows: Row[] }) {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();

  async function remove(id: string | "all") {
    const res = await deleteHistoryAction(id);
    if (!res.ok) return feedback.error(res);
    toast.success(id === "all" ? t("historyCleared") : t("historyDeleted"));
    router.refresh();
  }

  if (rows.length === 0) {
    return <EmptyState icon={<History />} title={t("noHistoryTitle")} description={t("noHistoryText")}
      action={<Button asChild><Link href="/client/calculator">{t("openCalculator")}</Link></Button>} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ConfirmDialog trigger={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 />{t("clearHistory")}</Button>}
          title={t("clearHistory")} description={t("clearHistoryConfirm")} confirmLabel={t("clearHistory")} onConfirm={() => remove("all")} />
      </div>
      <Card className="overflow-hidden">
        <Stagger className="divide-y">
          {rows.map((r) => (
            <StaggerItem key={r.id}>
              <div className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                <Thumb src={r.imageUrl} className="h-12 w-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.recipeName}</div>
                  <div className="text-xs text-muted-foreground">{r.date}</div>
                </div>
                <div className="text-end">
                  <div className="text-xs text-muted-foreground">{t("target")}</div>
                  <div className="font-serif text-lg font-semibold" dir="ltr">{r.target}</div>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm"><Link href={r.href}><RotateCw />{t("rerun")}</Link></Button>
                  <ConfirmDialog trigger={<Button variant="ghost" size="icon-sm" aria-label={t("deleteHistory")} className="text-destructive hover:text-destructive"><Trash2 /></Button>}
                    title={tc("deleteConfirmTitle")} description={tc("deleteConfirmText", { name: `${r.recipeName} — ${r.target}` })} onConfirm={() => remove(r.id)} />
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Card>
    </div>
  );
}
