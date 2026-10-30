"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { History, Loader2, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, FieldError } from "@/components/shared/form-fields";
import { ProductMultiSelect } from "@/components/shared/product-multi-select";
import { SupplierList } from "@/components/shared/supplier-list";
import { useCan } from "@/components/shared/staff-permissions";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { Money } from "@/components/commerce/shared";
import { PartyDebtDialog } from "@/components/commerce/debt-dialogs";
import { PartyHistoryDialog } from "@/components/commerce/party-history-dialog";
import { deleteSupplierAction, saveSupplierAction } from "@/actions/suppliers";
import { supplierSchema, type SupplierInput } from "@/lib/schemas";
import type { SupplierDTO, SupplierProductDTO } from "@/lib/suppliers";

export function SuppliersView({ suppliers, products, debts }: { suppliers: SupplierDTO[]; products: SupplierProductDTO[]; debts: Record<string, number> }) {
  const t = useTranslations("suppliers");
  const tm = useTranslations("commerce");
  const [history, setHistory] = useState<SupplierDTO | null>(null);
  const [paying, setPaying] = useState<SupplierDTO | null>(null);
  const tc = useTranslations("common");
  const router = useRouter();
  const can = useCan();
  const params = useSearchParams();
  const feedback = useActionFeedback();
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [open, setOpen] = useState(false);

  // The detail page links here with ?edit=<id>.
  useEffect(() => {
    const id = params.get("edit");
    if (!id) return;
    const s = suppliers.find((x) => x.id === id);
    if (s) { setEditing(s); setOpen(true); }
    router.replace("/admin/suppliers");
  }, [params, suppliers, router]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const newButton = can("suppliers.create") ? <Button onClick={openNew}><Plus />{t("new")}</Button> : undefined;

  return (
    <>
      {newButton && suppliers.length > 0 && <div className="mb-5 flex justify-end">{newButton}</div>}
      <SupplierList
        suppliers={suppliers}
        viewBase="/admin/suppliers"
        emptyAction={newButton}
        actions={(s) => (
          <>
            {(debts[s.id] ?? 0) > 0 && (
              can("purchases.pay")
                ? <Button variant="ghost" size="sm" className="text-destructive" title={tm("payDebt")} onClick={() => setPaying(s)}><Wallet /><Money value={debts[s.id]} /></Button>
                : <Money value={debts[s.id]} className="px-2 text-xs font-semibold text-destructive" />
            )}
            <Button variant="ghost" size="icon-sm" title={tm("history")} aria-label={`${tm("history")} ${s.fullName}`} onClick={() => setHistory(s)}><History /></Button>
            {can("suppliers.edit") && <Button variant="ghost" size="icon-sm" aria-label={`${tc("edit")} ${s.fullName}`} onClick={() => { setEditing(s); setOpen(true); }}><Pencil /></Button>}
            {can("suppliers.delete") && <ConfirmDialog
              trigger={<Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`${tc("delete")} ${s.fullName}`}><Trash2 /></Button>}
              title={tc("deleteConfirmTitle")}
              description={tc("deleteConfirmText", { name: s.fullName })}
              onConfirm={async () => {
                const res = await deleteSupplierAction(s.id);
                if (!res.ok) return feedback.error(res);
                toast.success(t("deleted"));
                router.refresh();
              }}
            />}
          </>
        )}
      />
      <SupplierFormDialog open={open} onOpenChange={setOpen} supplier={editing} products={products} onSaved={() => router.refresh()} />
      {history && <PartyHistoryDialog open onOpenChange={(o) => !o && setHistory(null)} kind="supplier" partyId={history.id} partyName={history.fullName} />}
      {paying && <PartyDebtDialog open onOpenChange={(o) => !o && setPaying(null)} kind="supplier" partyId={paying.id} partyName={paying.fullName} />}
    </>
  );
}

function SupplierFormDialog({ open, onOpenChange, supplier, products, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; supplier: SupplierDTO | null; products: SupplierProductDTO[]; onSaved: () => void;
}) {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const form = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      fullName: supplier?.fullName ?? "", address: supplier?.address ?? "", phone: supplier?.phone ?? "", phone2: supplier?.phone2 ?? "",
      productIds: supplier?.products.map((p) => p.id) ?? [],
    });
  }, [open, supplier, form]);

  async function submit(v: SupplierInput) {
    const res = await saveSupplierAction(supplier?.id ?? null, v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof SupplierInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(supplier ? t("updated", { name: res.data!.name }) : t("created", { name: res.data!.name }));
    onOpenChange(false);
    onSaved();
  }

  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{supplier ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fullName")} htmlFor="supplier-fullName" error={e.fullName?.message}>
              <Input id="supplier-fullName" placeholder={t("fullNamePlaceholder")} {...form.register("fullName")} aria-invalid={!!e.fullName} />
            </Field>
            <Field label={t("address")} htmlFor="supplier-address" error={e.address?.message} optional optionalLabel={tc("optional")}>
              <Input id="supplier-address" placeholder={t("addressPlaceholder")} {...form.register("address")} />
            </Field>
            <Field label={t("phone")} htmlFor="supplier-phone" error={e.phone?.message}>
              <Input id="supplier-phone" type="tel" dir="ltr" inputMode="tel" placeholder="0555 12 34 56" {...form.register("phone")} aria-invalid={!!e.phone} />
            </Field>
            <Field label={t("phone2")} htmlFor="supplier-phone2" error={e.phone2?.message} optional optionalLabel={tc("optional")}>
              <Input id="supplier-phone2" type="tel" dir="ltr" inputMode="tel" placeholder="0666 12 34 56" {...form.register("phone2")} aria-invalid={!!e.phone2} />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("products")}</p>
            <Controller control={form.control} name="productIds" render={({ field }) => (
              <ProductMultiSelect products={products} value={field.value ?? []} onChange={field.onChange} invalid={!!e.productIds} />
            )} />
            <FieldError message={e.productIds?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {form.formState.isSubmitting ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
