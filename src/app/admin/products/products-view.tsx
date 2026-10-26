"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConical, Languages, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Textarea } from "@/components/ui/basic";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Field } from "@/components/shared/form-fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { ManageUnitsDialog, UnitSelect } from "@/components/shared/units";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deleteProductAction, saveProductAction } from "@/actions/products";
import { productSchema, type ProductInput } from "@/lib/schemas";
import type { ProductDTO } from "@/lib/dto";
import { ldesc, lname } from "@/lib/i18n-data";
import { excerpt } from "@/lib/utils";

export function ProductsView({ products }: { products: ProductDTO[] }) {
  const can = useCan();
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const feedback = useActionFeedback();
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setEditing(null);
      setOpen(true);
      router.replace("/admin/products");
    }
  }, [params, router]);

  const columns = useMemo<ColumnDef<ProductDTO, unknown>[]>(() => [
    {
      id: "image", header: tc("image"), enableSorting: false, meta: { className: "w-16" },
      cell: ({ row }) => <Thumb src={row.original.imageUrl} alt={lname(row.original, locale)} />,
    },
    {
      id: "name", accessorFn: (r) => lname(r, locale), header: tc("name"),
      cell: ({ row }) => (
        <div className="min-w-[10rem]">
          <div className="font-medium">{lname(row.original, locale)}</div>
          {locale === "fr" && row.original.nameAr && <div className="text-xs text-muted-foreground" dir="rtl" lang="ar">{row.original.nameAr}</div>}
        </div>
      ),
    },
    {
      id: "unit", accessorFn: (r) => r.unit.symbol, header: tc("unit"),
      cell: ({ row }) => <Badge variant="secondary" className="font-mono">{row.original.unit.symbol}</Badge>,
    },
    {
      id: "description", accessorFn: (r) => ldesc(r, locale), header: tc("description"), enableSorting: false, meta: { className: "hidden xl:table-cell" },
      cell: ({ row }) => <span className="block max-w-sm text-muted-foreground">{excerpt(ldesc(row.original, locale), 90) || "—"}</span>,
    },
    {
      id: "usedIn", accessorFn: (r) => r.recipeCount ?? 0, header: t("usedIn"), meta: { className: "hidden lg:table-cell" },
      cell: ({ row }) => <span className="text-muted-foreground">{tc("recipesCount", { count: row.original.recipeCount ?? 0 })}</span>,
    },
    {
      id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "w-24 text-end" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can("products.edit") && <Button variant="ghost" size="icon-sm" aria-label={`${tc("edit")} ${row.original.name}`} onClick={() => { setEditing(row.original); setOpen(true); }}>
            <Pencil />
          </Button>}
          {can("products.delete") && <ConfirmDialog
            trigger={<Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`${tc("delete")} ${row.original.name}`}><Trash2 /></Button>}
            title={tc("deleteConfirmTitle")}
            description={tc("deleteConfirmText", { name: lname(row.original, locale) })}
            onConfirm={async () => {
              const res = await deleteProductAction(row.original.id);
              if (!res.ok) return feedback.error(res);
              toast.success(t("deleted"));
              router.refresh();
            }}
          />}
        </div>
      ),
    },
  ], [locale, t, tc, router, feedback, can]);

  return (
    <>
      <DataTable
        columns={columns}
        data={products}
        globalFilterFn={(p, q) => [p.name, p.nameAr, p.description, p.unit.symbol].some((v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q))}
        toolbar={
          <>
            <ManageUnitsDialog />
            {can("products.create") && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />{t("new")}</Button>}
          </>
        }
        empty={products.length === 0 ? (
          <EmptyState icon={<FlaskConical />} title={t("emptyTitle")} description={t("emptyText")} className="border-0 bg-transparent"
            action={can("products.create") ? <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />{t("new")}</Button> : undefined} />
        ) : undefined}
      />
      <ProductFormDialog open={open} onOpenChange={setOpen} product={editing} onSaved={() => router.refresh()} />
    </>
  );
}

function ProductFormDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; product: ProductDTO | null; onSaved: () => void }) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const form = useForm<ProductInput>({ resolver: zodResolver(productSchema) });
  const [showAr, setShowAr] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: product?.name ?? "", nameAr: product?.nameAr ?? "", description: product?.description ?? "", descriptionAr: product?.descriptionAr ?? "",
      imageUrl: product?.imageUrl ?? null, unitId: product?.unitId ?? "",
    });
    setShowAr(Boolean(product?.nameAr || product?.descriptionAr));
  }, [open, product, form]);

  async function submit(values: ProductInput) {
    const res = await saveProductAction(product?.id ?? null, values);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ProductInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(product ? t("updated", { name: res.data!.name }) : t("created", { name: res.data!.name }));
    onOpenChange(false);
    onSaved();
  }

  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{product ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-5 sm:grid-cols-[200px_1fr]" noValidate>
          <Field label={t("image")} htmlFor="product-image">
            <Controller control={form.control} name="imageUrl" render={({ field }) => (
              <ImageUpload id="product-image" bucket="products" preset="product" value={field.value} onChange={field.onChange} aspect="aspect-square" />
            )} />
          </Field>
          <div className="space-y-4">
            <Field label={t("name")} htmlFor="product-name" error={e.name?.message}>
              <Input id="product-name" placeholder={t("namePlaceholder")} {...form.register("name")} aria-invalid={!!e.name} />
            </Field>
            <Field label={t("unit")} htmlFor="product-unit" error={e.unitId?.message}>
              <Controller control={form.control} name="unitId" render={({ field }) => (
                <UnitSelect id="product-unit" value={field.value} onChange={field.onChange} invalid={!!e.unitId} />
              )} />
            </Field>
            <Field label={t("description")} htmlFor="product-description" optional optionalLabel={tc("optional")} error={e.description?.message}>
              <Textarea id="product-description" rows={3} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />
            </Field>
            <div className="rounded-xl border bg-background/50">
              <button type="button" onClick={() => setShowAr((s) => !s)} aria-expanded={showAr}
                className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-medium">
                <Languages className="h-4 w-4 text-primary" />
                <span className="flex-1">{t("arabicSection")}</span>
                <span className="text-xs font-normal text-muted-foreground">{t("arabicHint")}</span>
              </button>
              {showAr && (
                <div className="space-y-4 border-t p-4" dir="rtl" lang="ar">
                  <Field label={t("nameAr")} htmlFor="product-nameAr" error={e.nameAr?.message}>
                    <Input id="product-nameAr" {...form.register("nameAr")} />
                  </Field>
                  <Field label={t("descriptionAr")} htmlFor="product-descriptionAr" error={e.descriptionAr?.message}>
                    <Textarea id="product-descriptionAr" rows={3} {...form.register("descriptionAr")} />
                  </Field>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sm:col-span-2">
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
