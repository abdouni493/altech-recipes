"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Eye, MessageCircle, MoreHorizontal, Phone, RotateCcw, ShoppingBag, Trash2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/basic";
import {
  DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent,
} from "@/components/ui/overlays";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deleteOrderAction, setOrderStatusAction } from "@/actions/orders";
import { WILAYAS } from "@/lib/algeria";
import { formatDate } from "@/lib/format";
import { normalizeSearch, whatsappLink } from "@/lib/utils";

export type OrderRow = {
  id: string; orderNumber: string; fullName: string; phone: string; wilayaCode: string; wilayaName: string; communeName: string;
  item: { kind: "recipe" | "pack"; name: string } | null; message: string; wantsClientAccount: boolean;
  status: "PENDING" | "CONFIRMED" | "CANCELLED"; createdAt: string; confirmedAt: string | null; cancelledAt: string | null;
};

type PendingAction = { order: OrderRow; status: "CONFIRMED" | "CANCELLED" } | null;

export function OrdersView({ rows, siteName }: { rows: OrderRow[]; siteName: string }) {
  const t = useTranslations("orders");
  const can = useCan();
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const feedback = useActionFeedback();
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [wilaya, setWilaya] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [toDelete, setToDelete] = useState<OrderRow | null>(null);

  useEffect(() => {
    const id = params.get("open");
    if (id) setDetail(rows.find((r) => r.id === id) ?? null);
  }, [params, rows]);
  // Keep the open drawer in sync after a status change.
  useEffect(() => { setDetail((d) => (d ? rows.find((r) => r.id === d.id) ?? null : d)); }, [rows]);

  async function changeStatus(order: OrderRow, next: OrderRow["status"]) {
    const res = await setOrderStatusAction(order.id, next);
    if (!res.ok) return feedback.error(res);
    if (next === "CONFIRMED") toast.success(t("toast.confirmed", { number: order.orderNumber }));
    else if (next === "CANCELLED") toast.success(t("toast.cancelled", { number: order.orderNumber }));
    else toast.success(t("status.PENDING"));
    router.refresh();
  }

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (wilaya !== "all" && r.wilayaCode !== wilaya) return false;
    const d = r.createdAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [rows, status, wilaya, from, to]);

  const usedWilayas = useMemo(() => WILAYAS.filter((w) => rows.some((r) => r.wilayaCode === w.code)), [rows]);

  const actionsMenu = (o: OrderRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`${tc("actions")} — ${o.orderNumber}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setDetail(o)}><Eye />{t("actions.details")}</DropdownMenuItem>
        {can("orders.edit") && o.status !== "CONFIRMED" && <DropdownMenuItem onSelect={() => setPending({ order: o, status: "CONFIRMED" })}><CheckCircle2 />{t("actions.confirm")}</DropdownMenuItem>}
        {can("orders.edit") && o.status !== "CANCELLED" && <DropdownMenuItem onSelect={() => setPending({ order: o, status: "CANCELLED" })}><XCircle />{t("actions.cancel")}</DropdownMenuItem>}
        {can("orders.edit") && o.status !== "PENDING" && <DropdownMenuItem onSelect={() => changeStatus(o, "PENDING")}><RotateCcw />{t("status.PENDING")}</DropdownMenuItem>}
        {can("clients.create") && <DropdownMenuItem asChild><Link href={`/admin/clients/new?order=${o.id}`}><UserPlus />{t("actions.convert")}</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        {can("orders.delete") && <DropdownMenuItem destructive onSelect={() => setToDelete(o)}><Trash2 />{t("actions.delete")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns = useMemo<ColumnDef<OrderRow, unknown>[]>(() => [
    { id: "orderNumber", accessorKey: "orderNumber", header: t("orderNumber"), cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs font-semibold">{row.original.orderNumber}</span> },
    { id: "date", accessorKey: "createdAt", header: t("date"), cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt, locale)}</span> },
    { id: "fullName", accessorKey: "fullName", header: t("fullName"), cell: ({ row }) => (
      <span className="flex items-center gap-2 font-medium">{row.original.fullName}{row.original.wantsClientAccount && <UserPlus className="h-3.5 w-3.5 text-primary" aria-label={t("wantsAccount")} />}</span>
    ) },
    { id: "phone", accessorKey: "phone", header: t("phone"), cell: ({ row }) => <a href={`tel:${row.original.phone}`} onClick={(e) => e.stopPropagation()} dir="ltr" className="whitespace-nowrap hover:text-primary">{row.original.phone}</a> },
    { id: "wilaya", accessorFn: (r) => r.wilayaCode, header: t("wilaya"), meta: { className: "hidden md:table-cell" }, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.wilayaCode} · {row.original.wilayaName}</span> },
    { id: "commune", accessorKey: "communeName", header: t("commune"), meta: { className: "hidden lg:table-cell" } },
    { id: "item", accessorFn: (r) => r.item?.name ?? "", header: t("item"), meta: { className: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.item ? <span className="flex items-center gap-1.5"><Badge variant="secondary">{t(row.original.item.kind)}</Badge>{row.original.item.name}</span> : <span className="text-muted-foreground">{t("noItem")}</span> },
    { id: "status", accessorKey: "status", header: tc("status"), cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
    { id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "w-14 text-end" }, cell: ({ row }) => actionsMenu(row.original) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [locale, t, tc]);

  if (rows.length === 0) return <EmptyState icon={<ShoppingBag />} title={t("emptyTitle")} />;

  const resetFilters = () => { setStatus("all"); setWilaya("all"); setFrom(""); setTo(""); };
  const d = detail;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" id="f-status">{t("filters.status")}</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44" aria-labelledby="f-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
              {(["PENDING", "CONFIRMED", "CANCELLED"] as const).map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" id="f-wilaya">{t("filters.wilaya")}</label>
          <Select value={wilaya} onValueChange={setWilaya}>
            <SelectTrigger className="h-9 w-52" aria-labelledby="f-wilaya"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allWilayas")}</SelectItem>
              {usedWilayas.map((w) => <SelectItem key={w.code} value={w.code}>{w.code} · {locale === "ar" ? w.ar : w.fr}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="f-from" className="text-xs font-medium text-muted-foreground">{t("filters.from")}</label>
          <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <label htmlFor="f-to" className="text-xs font-medium text-muted-foreground">{t("filters.to")}</label>
          <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters}><RotateCcw />{t("filters.reset")}</Button>
      </div>

      <DataTable columns={columns} data={filtered} searchPlaceholder={t("filters.search")} empty={t("empty")}
        onRowClick={(o) => setDetail(o)} rowClassName={(o) => (o.status === "PENDING" ? "bg-warning/5" : undefined)}
        globalFilterFn={(o, q) => normalizeSearch(o.fullName).includes(q) || o.phone.includes(q.replace(/\s/g, "")) || normalizeSearch(o.orderNumber).includes(q)} />

      <Sheet open={!!d} onOpenChange={(o) => { if (!o) { setDetail(null); if (params.get("open")) router.replace("/admin/orders"); } }}>
        <SheetContent closeLabel={tc("close")} aria-describedby={undefined}>
          {d && (
            <div className="space-y-6">
              <div className="space-y-2 pe-8">
                <DialogTitle className="font-serif text-2xl font-semibold">{t("detailsTitle", { number: d.orderNumber })}</DialogTitle>
                <OrderStatusBadge status={d.status} />
              </div>
              <dl className="divide-y rounded-xl border text-sm">
                {[
                  [t("fullName"), d.fullName],
                  [t("phone"), <span key="p" dir="ltr">{d.phone}</span>],
                  [t("wilaya"), `${d.wilayaCode} · ${d.wilayaName}`],
                  [t("commune"), d.communeName],
                  [t("item"), d.item ? `${t(d.item.kind)} — ${d.item.name}` : t("noItem")],
                  [t("wantsAccount"), d.wantsClientAccount ? tc("yes") : tc("no")],
                  [t("createdAt"), formatDate(d.createdAt, locale, true)],
                  ...(d.confirmedAt ? [[t("confirmedAt"), formatDate(d.confirmedAt, locale, true)]] : []),
                  ...(d.cancelledAt ? [[t("cancelledAt"), formatDate(d.cancelledAt, locale, true)]] : []),
                ].map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[9rem_1fr] gap-3 p-3">
                    <dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {d.message && (
                <div>
                  <p className="mb-1 text-sm font-medium">{t("message")}</p>
                  <p className="whitespace-pre-line rounded-xl bg-secondary p-3 text-sm">{d.message}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline"><a href={`tel:${d.phone}`}><Phone />{t("actions.call")}</a></Button>
                <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                  <a href={whatsappLink(d.phone, t("whatsappMessage", { name: d.fullName, number: d.orderNumber, site: siteName }))} target="_blank" rel="noopener noreferrer"><MessageCircle />{t("actions.whatsapp")}</a>
                </Button>
                {can("orders.edit") && d.status !== "CONFIRMED" && <Button onClick={() => setPending({ order: d, status: "CONFIRMED" })}><CheckCircle2 />{t("actions.confirm")}</Button>}
                {can("orders.edit") && d.status !== "CANCELLED" && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setPending({ order: d, status: "CANCELLED" })}><XCircle />{t("actions.cancel")}</Button>}
                {can("clients.create") && <Button asChild variant="secondary" className="col-span-2"><Link href={`/admin/clients/new?order=${d.id}`}><UserPlus />{t("actions.convert")}</Link></Button>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}
        variant={pending?.status === "CANCELLED" ? "destructive" : "default"}
        confirmLabel={pending?.status === "CANCELLED" ? t("actions.cancel") : t("actions.confirm")}
        title={pending?.status === "CANCELLED" ? t("cancelTitle") : t("confirmTitle")}
        description={pending ? (pending.status === "CANCELLED" ? t("cancelText", { number: pending.order.orderNumber }) : t("confirmText", { number: pending.order.orderNumber })) : ""}
        onConfirm={async () => { if (pending) await changeStatus(pending.order, pending.status); }} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title={tc("deleteConfirmTitle")}
        description={toDelete ? tc("deleteConfirmText", { name: toDelete.orderNumber }) : ""}
        onConfirm={async () => {
          if (!toDelete) return;
          const res = await deleteOrderAction(toDelete.id);
          if (!res.ok) return feedback.error(res);
          toast.success(t("toast.deleted"));
          setDetail(null);
          router.refresh();
        }} />
    </>
  );
}
