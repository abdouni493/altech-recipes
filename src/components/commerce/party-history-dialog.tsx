"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { partyHistoryAction } from "@/actions/commerce";
import type { PartyHistory } from "@/lib/commerce";
import { formatDate } from "@/lib/format";
import { DateRange, Money, PaymentStatusBadge, PrintLink } from "./shared";

/** History of a client (sales) or a supplier (purchases): documents, payments and a ledger with running balance. */
export function PartyHistoryDialog({
  open, onOpenChange, kind, partyId, partyName,
}: { open: boolean; onOpenChange: (o: boolean) => void; kind: "client" | "supplier"; partyId: string; partyName: string }) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<PartyHistory | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    partyHistoryAction(kind, partyId, from || null, to || null).then((res) => {
      if (!res.ok) return feedback.error(res);
      setData(res.data!);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, partyId, from, to]);

  const docLabel = kind === "client" ? t("invoices") : t("purchasesTab");
  const printBase = kind === "client" ? "/print/sales" : "/print/purchases";
  let balance = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("history")} — {partyName}</DialogTitle>
          <DialogDescription>{t("historyHint")}</DialogDescription>
        </DialogHeader>
        <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
        {!data ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label={docLabel} value={String(data.totals.count)} />
              <Stat label={t("total")} value={<Money value={data.totals.total} />} />
              <Stat label={t("paid")} value={<Money value={data.totals.paid} />} />
              <Stat label={t("debt")} value={<Money value={data.totals.debt} className={data.totals.debt > 0 ? "text-destructive" : ""} />} />
            </div>
            <Tabs defaultValue="docs">
              <TabsList>
                <TabsTrigger value="docs">{docLabel}</TabsTrigger>
                <TabsTrigger value="payments">{t("payments")}</TabsTrigger>
                <TabsTrigger value="ledger">{t("ledger")}</TabsTrigger>
              </TabsList>
              <TabsContent value="docs">
                <SimpleTable empty={t("nothingYet")} head={[t("number"), t("date"), t("total"), t("paid"), t("remaining"), t("status"), ""]}
                  rows={data.documents.map((d) => [
                    <span key="n" className="font-mono text-xs">{d.number}</span>, formatDate(d.date, locale),
                    <Money key="t" value={d.total} />, <Money key="p" value={d.paidAmount} />, <Money key="r" value={d.remaining} />,
                    <PaymentStatusBadge key="s" total={d.total} paid={d.paidAmount} />,
                    <PrintLink key="pr" href={`${printBase}/${d.id}`} label={t("print")} />,
                  ])} />
              </TabsContent>
              <TabsContent value="payments">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("number"), t("amount"), t("note")]}
                  rows={data.payments.map((p) => [formatDate(p.paidAt, locale, true), <span key="n" className="font-mono text-xs">{p.reference}</span>, <Money key="a" value={p.amount} />, p.note || "—"])} />
              </TabsContent>
              <TabsContent value="ledger">
                <SimpleTable empty={t("nothingYet")} head={[t("date"), t("operation"), t("number"), t("debit"), t("credit"), t("balance")]}
                  rows={data.ledger.map((l) => {
                    balance += l.debit - l.credit;
                    return [formatDate(l.date, locale, true), l.type === "PAYMENT" ? t("payment") : docLabel, <span key="n" className="font-mono text-xs">{l.reference}</span>,
                      l.debit ? <Money key="d" value={l.debit} /> : "—", l.credit ? <Money key="c" value={l.credit} /> : "—", <Money key="b" value={balance} className="font-semibold" />];
                  })} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

export function SimpleTable({ head, rows, empty }: { head: React.ReactNode[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="max-h-[50vh] overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-secondary text-xs uppercase text-muted-foreground">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-start">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0
            ? <tr><td colSpan={head.length} className="px-3 py-10 text-center text-muted-foreground">{empty}</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
