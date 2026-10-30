"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { useCan } from "@/components/shared/staff-permissions";
import type { PaymentDTO } from "@/lib/commerce";
import { formatDate } from "@/lib/format";
import { PayDebtDialog } from "./debt-dialogs";
import { SimpleTable } from "./party-history-dialog";
import { Money, PaymentStatusBadge, PrintLink, SummaryRow } from "./shared";

/** Two-part details view of a purchase or a sale: document on one side, payments on the other. */
export function DocumentDetails({
  kind, id, number, info, head, rows, summary, total, paid, remaining, payments,
}: {
  kind: "PURCHASE" | "SALE"; id: string; number: string;
  info: { label: string; value: React.ReactNode }[];
  head: string[]; rows: React.ReactNode[][];
  summary: { label: string; value: number }[];
  total: number; paid: number; remaining: number; payments: PaymentDTO[];
}) {
  const t = useTranslations("commerce");
  const locale = useLocale();
  const can = useCan();
  const [paying, setPaying] = useState(false);
  const canPay = can(kind === "PURCHASE" ? "purchases.pay" : "sales.pay") && remaining > 0;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="font-mono text-lg">{number}</CardTitle>
          <PrintLink href={`/print/${kind === "PURCHASE" ? "purchases" : "sales"}/${id}`} label={t("print")} size="sm" />
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            {info.map((i) => (
              <div key={i.label} className="rounded-xl border bg-secondary/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{i.label}</dt>
                <dd className="mt-0.5 font-medium">{i.value}</dd>
              </div>
            ))}
          </dl>
          <SimpleTable head={head} rows={rows} empty={t("noLines")} />
          <div className="ms-auto max-w-xs">
            {summary.map((s) => <SummaryRow key={s.label} label={s.label}><Money value={s.value} /></SummaryRow>)}
            <SummaryRow label={t("total")} strong><Money value={total} /></SummaryRow>
          </div>
        </CardContent>
      </Card>
      <Card className="lg:self-start">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-lg">{t("payments")}</CardTitle>
          <PaymentStatusBadge total={total} paid={paid} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-secondary/30 px-4 py-2">
            <SummaryRow label={t("total")}><Money value={total} /></SummaryRow>
            <SummaryRow label={t("paid")}><Money value={paid} className="text-success" /></SummaryRow>
            <SummaryRow label={t("remaining")} strong><Money value={remaining} className={remaining > 0 ? "text-destructive" : ""} /></SummaryRow>
          </div>
          {canPay && <Button className="w-full" onClick={() => setPaying(true)}><Wallet />{t("payDebt")}</Button>}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("paymentHistory")}</h3>
            {payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("noPayments")}</p> : (
              <ol className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">{formatDate(p.paidAt, locale, true)}</div>
                      {(p.note || p.createdBy) && <div className="truncate text-xs text-muted-foreground">{[p.createdBy, p.note].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <Money value={p.amount} className="font-semibold" />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>
      {paying && <PayDebtDialog open onOpenChange={setPaying} kind={kind} refId={id} number={number} remaining={remaining} />}
    </div>
  );
}
