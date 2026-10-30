"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Receipt, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { useCan } from "@/components/shared/staff-permissions";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { DateRange, inRange, Money, PaymentStatusBadge, PrintLink } from "@/components/commerce/shared";
import { PayDebtDialog } from "@/components/commerce/debt-dialogs";
import { Stat } from "@/components/commerce/party-history-dialog";
import { deleteSaleAction } from "@/actions/commerce";
import { round2, type SaleDTO } from "@/lib/commerce";
import { formatDate } from "@/lib/format";

export function SalesView({ sales }: { sales: SaleDTO[] }) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const can = useCan();
  const feedback = useActionFeedback();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paying, setPaying] = useState<SaleDTO | null>(null);

  const rows = useMemo(() => sales.filter((p) => inRange(p.date, from, to)), [sales, from, to]);
  const sum = (k: "total" | "paidAmount" | "remaining") => round2(rows.reduce((s, r) => s + r[k], 0));

  const columns = useMemo<ColumnDef<SaleDTO, unknown>[]>(() => [
    { id: "number", accessorKey: "number", header: t("number"), cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.number}</span> },
    { id: "date", accessorKey: "date", header: t("date"), cell: ({ row }) => formatDate(row.original.date, locale, true) },
    { id: "client", accessorFn: (r) => r.clientName ?? "", header: t("client"), cell: ({ row }) => row.original.clientName ?? <span className="text-muted-foreground">{t("walkIn")}</span> },
    { id: "items", accessorKey: "itemsCount", header: t("items"), meta: { className: "hidden md:table-cell" } },
    { id: "total", accessorKey: "total", header: t("total"), cell: ({ row }) => <Money value={row.original.total} className="font-semibold" /> },
    { id: "paid", accessorKey: "paidAmount", header: t("paid"), meta: { className: "hidden lg:table-cell" }, cell: ({ row }) => <Money value={row.original.paidAmount} /> },
    { id: "remaining", accessorKey: "remaining", header: t("remaining"), cell: ({ row }) => <Money value={row.original.remaining} className={row.original.remaining > 0 ? "text-destructive" : ""} /> },
    { id: "status", header: t("status"), enableSorting: false, cell: ({ row }) => <PaymentStatusBadge total={row.original.total} paid={row.original.paidAmount} /> },
    {
      id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "text-end" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex justify-end gap-0.5">
            {can("sales.pay") && p.remaining > 0 && (
              <Button variant="ghost" size="icon-sm" className="text-success" title={t("payDebt")} aria-label={t("payDebt")} onClick={() => setPaying(p)}><Wallet /></Button>
            )}
            <Button variant="ghost" size="icon-sm" asChild title={t("details")} aria-label={t("details")}><Link href={`/admin/sales/${p.id}`}><Eye /></Link></Button>
            <PrintLink href={`/print/sales/${p.id}`} label={t("print")} />
            {can("sales.edit") && <Button variant="ghost" size="icon-sm" asChild title={tc("edit")} aria-label={tc("edit")}><Link href={`/admin/sales/${p.id}/edit`}><Pencil /></Link></Button>}
            {can("sales.delete") && (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={tc("delete")}><Trash2 /></Button>}
                title={tc("deleteConfirmTitle")} description={t("deleteSaleText", { number: p.number })}
                onConfirm={async () => {
                  const res = await deleteSaleAction(p.id);
                  if (!res.ok) return feedback.error(res);
                  toast.success(t("deleted"));
                  router.refresh();
                }} />
            )}
          </div>
        );
      },
    },
  ], [t, tc, locale, can, feedback, router]);

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label={t("total")} value={<Money value={sum("total")} />} />
        <Stat label={t("paid")} value={<Money value={sum("paidAmount")} />} />
        <Stat label={t("debtToCollect")} value={<Money value={sum("remaining")} className="text-destructive" />} />
      </div>
      <DataTable columns={columns} data={rows} searchPlaceholder={t("searchSales")}
        globalFilterFn={(p, q) => `${p.number} ${p.clientName ?? ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q)}
        toolbar={<DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />}
        empty={sales.length === 0 ? <EmptyState icon={<Receipt />} title={t("noSales")} description={t("noSalesHint")} className="border-0 bg-transparent" /> : undefined} />
      {paying && <PayDebtDialog open onOpenChange={(o) => !o && setPaying(null)} kind="SALE" refId={paying.id} number={paying.number} remaining={paying.remaining} />}
    </>
  );
}
