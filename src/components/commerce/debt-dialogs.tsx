"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Checkbox } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/shared/form-fields";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { addPaymentAction, payPartyDebtAction, unpaidDocumentsAction } from "@/actions/commerce";
import { parseAmount, round2 } from "@/lib/commerce";
import { formatDate } from "@/lib/format";
import { Money, SummaryRow } from "./shared";

/** Pay (part of) what remains on one purchase or one sale. */
export function PayDebtDialog({
  open, onOpenChange, kind, refId, number, remaining,
}: { open: boolean; onOpenChange: (o: boolean) => void; kind: "PURCHASE" | "SALE"; refId: string; number: string; remaining: number }) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setAmount(String(round2(remaining))); setNote(""); }
  }, [open, remaining]);

  const value = parseAmount(amount);
  const invalid = !(value > 0) || round2(value) > round2(remaining);

  async function save() {
    setBusy(true);
    const res = await addPaymentAction(kind, refId, value, note);
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(t("paymentSaved"));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("payDebt")}</DialogTitle>
          <DialogDescription>{number}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-secondary/40 px-4 py-2">
            <SummaryRow label={t("remainingToPay")} strong><Money value={remaining} /></SummaryRow>
          </div>
          <Field label={t("amountToPay")} htmlFor="pay-amount" error={value > remaining ? "commerce.errors.amountTooHigh" : undefined}>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <Field label={t("note")} htmlFor="pay-note" optional optionalLabel={tc("optional")}>
            <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <div className="rounded-xl border px-4 py-2">
            <SummaryRow label={t("remainingAfter")} strong><Money value={Math.max(0, round2(remaining - value))} /></SummaryRow>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tc("cancel")}</Button>
          <Button onClick={save} disabled={busy || invalid}>{busy && <Loader2 className="animate-spin" />}{t("savePayment")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Doc = { id: string; number: string; date: string; total: number; remaining: number };

/** Pay the debt of a client / supplier, spread over the invoices the user selects. */
export function PartyDebtDialog({
  open, onOpenChange, kind, partyId, partyName,
}: { open: boolean; onOpenChange: (o: boolean) => void; kind: "client" | "supplier"; partyId: string; partyName: string }) {
  const t = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDocs(null); setNote("");
    unpaidDocumentsAction(kind, partyId).then((res) => {
      if (!res.ok) { feedback.error(res); setDocs([]); return; }
      const rows = res.data ?? [];
      setDocs(rows);
      setAmounts(Object.fromEntries(rows.map((d) => [d.id, String(d.remaining)])));
      setSelected(new Set(rows.map((d) => d.id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, partyId]);

  const allocations = useMemo(
    () => (docs ?? []).filter((d) => selected.has(d.id)).map((d) => ({ id: d.id, amount: Math.min(round2(parseAmount(amounts[d.id])), d.remaining) })),
    [docs, selected, amounts],
  );
  const total = round2(allocations.reduce((s, a) => s + a.amount, 0));
  const debt = round2((docs ?? []).reduce((s, d) => s + d.remaining, 0));

  async function save() {
    setBusy(true);
    const res = await payPartyDebtAction(kind, partyId, allocations.filter((a) => a.amount > 0), note);
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(t("paymentSaved"));
    onOpenChange(false);
    router.refresh();
  }

  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("payDebt")} — {partyName}</DialogTitle>
          <DialogDescription>{t("selectInvoicesToPay")}</DialogDescription>
        </DialogHeader>
        {docs === null ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground"><Wallet className="h-8 w-8" />{t("noDebt")}</div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2"><span className="sr-only">{t("select")}</span></th>
                    <th className="px-3 py-2 text-start">{t("number")}</th>
                    <th className="px-3 py-2 text-start">{t("date")}</th>
                    <th className="px-3 py-2 text-end">{t("remaining")}</th>
                    <th className="px-3 py-2 text-end">{t("amountToPay")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2"><Checkbox checked={selected.has(d.id)} onCheckedChange={(c) => toggle(d.id, c === true)} aria-label={d.number} /></td>
                      <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(d.date, locale)}</td>
                      <td className="px-3 py-2 text-end"><Money value={d.remaining} /></td>
                      <td className="px-3 py-2">
                        <Input inputMode="decimal" className="ms-auto h-8 w-28 text-end" disabled={!selected.has(d.id)} value={amounts[d.id] ?? ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [d.id]: e.target.value }))} aria-label={`${t("amountToPay")} ${d.number}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Field label={t("note")} htmlFor="party-pay-note" optional optionalLabel={tc("optional")}>
              <Input id="party-pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
            <div className="rounded-xl border bg-secondary/40 px-4 py-2">
              <SummaryRow label={t("totalDebt")}><Money value={debt} /></SummaryRow>
              <SummaryRow label={t("totalToPay")} strong><Money value={total} /></SummaryRow>
              <SummaryRow label={t("remainingAfter")}><Money value={Math.max(0, round2(debt - total))} /></SummaryRow>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tc("cancel")}</Button>
          <Button onClick={save} disabled={busy || !(total > 0)}>{busy && <Loader2 className="animate-spin" />}{t("savePayment")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
