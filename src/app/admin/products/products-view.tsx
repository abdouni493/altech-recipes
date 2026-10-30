"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Barcode, Boxes, Eye, EyeOff, FlaskConical, History, Languages, Loader2, MoreHorizontal, PackageCheck, PackageX, Pencil, Plus, Printer, Shuffle, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Textarea } from "@/components/ui/basic";
import { Switch } from "@/components/ui/primitives";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Field } from "@/components/shared/form-fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { ManageUnitsDialog, UnitSelect } from "@/components/shared/units";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { Money } from "@/components/commerce/shared";
import { deleteProductAction, saveProductAction } from "@/actions/products";
import { adjustStockAction, barcodeTakenAction, setProductFlagAction } from "@/actions/commerce";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { generateEan13, parseAmount, type CommerceProductDTO } from "@/lib/commerce";
import type { ProductDTO } from "@/lib/dto";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { cn, normalizeSearch } from "@/lib/utils";
import { ProductHistoryDialog } from "./product-history-dialog";

export type StockProductDTO = ProductDTO & Omit<CommerceProductDTO, "unitSymbol"> & {
  lastPurchase: { date: string | null; supplier: string | null; unitCost: number } | null;
};

export function barcodeLabelUrl(p: { barcode: string | null; name: string; priceDetail: number }, count = 1) {
  const qs = new URLSearchParams({ code: p.barcode ?? "", name: p.name, price: String(p.priceDetail), n: String(count) });
  return `/print/barcode?${qs}`;
}

export function ProductsView({ products }: { products: StockProductDTO[] }) {
  const can = useCan();
  const t = useTranslations("products");
  const tm = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const feedback = useActionFeedback();
  const [editing, setEditing] = useState<StockProductDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<StockProductDTO | null>(null);
  const [adjusting, setAdjusting] = useState<StockProductDTO | null>(null);
  const [deleting, setDeleting] = useState<StockProductDTO | null>(null);
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setEditing(null);
      setOpen(true);
      router.replace("/admin/products");
    }
  }, [params, router]);

  async function toggle(p: StockProductDTO, flag: "isVisibleOnWebsite" | "isOutOfStock") {
    const res = await setProductFlagAction(p.id, flag, !p[flag]);
    if (!res.ok) return feedback.error(res);
    toast.success(tm("productUpdated"));
    router.refresh();
  }

  const isLow = (p: StockProductDTO) => p.stockQuantity <= p.minStockAlert;
  const rows = useMemo(() => (lowOnly ? products.filter(isLow) : products), [products, lowOnly]);
  const lowCount = products.filter(isLow).length;

  const columns = useMemo<ColumnDef<StockProductDTO, unknown>[]>(() => [
    {
      id: "image", header: tc("image"), enableSorting: false, meta: { className: "w-16" },
      cell: ({ row }) => <Thumb src={row.original.imageUrl} alt={lname(row.original, locale)} />,
    },
    {
      id: "name", accessorFn: (r) => lname(r, locale), header: tc("name"),
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-[11rem] space-y-1">
            <div className="font-medium">{lname(p, locale)}</div>
            {p.barcode && <div className="font-mono text-xs text-muted-foreground" dir="ltr">{p.barcode}</div>}
            <div className="flex flex-wrap gap-1">
              {p.isVisibleOnWebsite ? <Badge variant="default">{tm("onWebsite")}</Badge> : <Badge variant="secondary">{tm("hiddenFromWebsite")}</Badge>}
              {p.isOutOfStock && <Badge variant="destructive">{tm("outOfStock")}</Badge>}
            </div>
          </div>
        );
      },
    },
    {
      id: "stock", accessorKey: "stockQuantity", header: tm("stock"),
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="whitespace-nowrap">
            <span className={cn("font-semibold tabular-nums", isLow(p) && "text-destructive")}>{formatNumber(p.stockQuantity, locale)} {p.unit.symbol}</span>
            {isLow(p) && <Badge variant="destructive" className="ms-2">{tm("lowStock")}</Badge>}
            <div className="text-xs text-muted-foreground">{tm("minStockAlert")}: {formatNumber(p.minStockAlert, locale)}</div>
          </div>
        );
      },
    },
    {
      id: "purchase", accessorKey: "purchasePrice", header: tm("purchasePrice"), meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => <Money value={row.original.purchasePrice} />,
    },
    {
      id: "prices", accessorKey: "priceDetail", header: tm("sellingPrices"),
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          <div><span className="text-muted-foreground">{tm("priceTypes.DETAIL")}: </span><Money value={row.original.priceDetail} className="font-semibold" /></div>
          <div><span className="text-muted-foreground">{tm("priceTypes.RESELLER")}: </span><Money value={row.original.priceReseller} /></div>
          <div><span className="text-muted-foreground">{tm("priceTypes.WHOLESALE")}: </span><Money value={row.original.priceWholesale} /></div>
        </div>
      ),
    },
    {
      id: "usedIn", accessorFn: (r) => r.recipeCount ?? 0, header: t("usedIn"), meta: { className: "hidden xl:table-cell" },
      cell: ({ row }) => <span className="text-muted-foreground">{tc("recipesCount", { count: row.original.recipeCount ?? 0 })}</span>,
    },
    {
      id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "w-28 text-end" },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" title={tm("history")} aria-label={`${tm("history")} ${p.name}`} onClick={() => setHistory(p)}><History /></Button>
            {can("products.edit") && <Button variant="ghost" size="icon-sm" aria-label={`${tc("edit")} ${p.name}`} onClick={() => { setEditing(p); setOpen(true); }}><Pencil /></Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={tc("actions")}><MoreHorizontal /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can("products.edit") && (
                  <>
                    <DropdownMenuItem onSelect={() => toggle(p, "isVisibleOnWebsite")}>
                      {p.isVisibleOnWebsite ? <EyeOff /> : <Eye />}{p.isVisibleOnWebsite ? tm("hideFromWebsite") : tm("showOnWebsite")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => toggle(p, "isOutOfStock")}>
                      {p.isOutOfStock ? <PackageCheck /> : <PackageX />}{p.isOutOfStock ? tm("markInStock") : tm("markOutOfStock")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAdjusting(p)}><Boxes />{tm("adjustStock")}</DropdownMenuItem>
                  </>
                )}
                {p.barcode && <DropdownMenuItem onSelect={() => window.open(barcodeLabelUrl(p, 1), "_blank", "noopener")}><Printer />{tm("printBarcode")}</DropdownMenuItem>}
                {can("products.delete") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setDeleting(p)}><Trash2 />{tc("delete")}</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [locale, t, tc, tm, can]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder={tm("searchProductHint")}
        globalFilterFn={(p, q) => normalizeSearch(`${p.name} ${p.nameAr} ${p.description} ${p.descriptionAr} ${p.barcode ?? ""} ${p.unit.symbol}`).includes(q)}
        rowClassName={(p) => (isLow(p) ? "bg-destructive/[0.03]" : undefined)}
        toolbar={
          <>
            <Button variant={lowOnly ? "default" : "outline"} size="sm" onClick={() => setLowOnly((v) => !v)}>
              {tm("lowStock")} ({lowCount})
            </Button>
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
      {history && <ProductHistoryDialog open onOpenChange={(o) => !o && setHistory(null)} product={history} />}
      {adjusting && <AdjustStockDialog product={adjusting} onClose={() => setAdjusting(null)} />}
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}
        title={tc("deleteConfirmTitle")} description={deleting ? tc("deleteConfirmText", { name: lname(deleting, locale) }) : undefined}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteProductAction(deleting.id);
          if (!res.ok) { feedback.error(res); return false; }
          toast.success(t("deleted"));
          router.refresh();
        }} />
    </>
  );
}

function AdjustStockDialog({ product, onClose }: { product: StockProductDTO; onClose: () => void }) {
  const tm = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const [qty, setQty] = useState(String(product.stockQuantity));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await adjustStockAction(product.id, parseAmount(qty, product.stockQuantity), note);
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(tm("stockAdjusted"));
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{tm("adjustStock")}</DialogTitle>
          <DialogDescription>{lname(product, locale)} — {tm("currentStock")}: {formatNumber(product.stockQuantity, locale)} {product.unit.symbol}</DialogDescription>
        </DialogHeader>
        <Field label={`${tm("newStock")} (${product.unit.symbol})`} htmlFor="adj-qty" hint={tm("adjustStockHint")}>
          <Input id="adj-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label={tm("note")} htmlFor="adj-note" optional optionalLabel={tc("optional")}>
          <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{tc("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductFormDialog({ open, onOpenChange, product, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; product: StockProductDTO | null; onSaved: () => void }) {
  const t = useTranslations("products");
  const tm = useTranslations("commerce");
  const tc = useTranslations("common");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const form = useForm<ProductInput>({ resolver: zodResolver(productSchema) });
  const [showAr, setShowAr] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: product?.name ?? "", nameAr: product?.nameAr ?? "", description: product?.description ?? "", descriptionAr: product?.descriptionAr ?? "",
      imageUrl: product?.imageUrl ?? null, unitId: product?.unitId ?? "", barcode: product?.barcode ?? "",
      purchasePrice: product?.purchasePrice ?? 0, priceDetail: product?.priceDetail ?? 0, priceReseller: product?.priceReseller ?? 0,
      priceWholesale: product?.priceWholesale ?? 0, minStockAlert: product?.minStockAlert ?? 0, stockQuantity: product?.stockQuantity ?? 0,
      isVisibleOnWebsite: product?.isVisibleOnWebsite ?? false,
    });
    setShowAr(Boolean(product?.nameAr || product?.descriptionAr));
  }, [open, product, form]);

  async function generate() {
    setGenerating(true);
    for (let i = 0; i < 5; i++) {
      const code = generateEan13();
      const res = await barcodeTakenAction(code, product?.id ?? null);
      if (res.ok && !res.data!.taken) {
        form.setValue("barcode", code, { shouldDirty: true });
        break;
      }
    }
    setGenerating(false);
  }

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
  const barcode = form.watch("barcode");
  const num = (name: keyof ProductInput, label: string, error?: string) => (
    <Field label={label} htmlFor={`product-${name}`} error={error}>
      <Input id={`product-${name}`} inputMode="decimal" dir="ltr" {...form.register(name)} />
    </Field>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" closeLabel={tc("close")}>
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
            <Field label={tm("barcode")} htmlFor="product-barcode" optional optionalLabel={tc("optional")} error={e.barcode?.message} hint={tm("barcodeHint")}>
              <div className="flex gap-2">
                <Input id="product-barcode" dir="ltr" className="font-mono" {...form.register("barcode")}
                  onKeyDown={(ev) => { if (ev.key === "Enter") ev.preventDefault(); }} />
                <Button type="button" variant="outline" size="icon" onClick={generate} disabled={generating} title={tm("generateBarcode")} aria-label={tm("generateBarcode")}>
                  {generating ? <Loader2 className="animate-spin" /> : <Shuffle />}
                </Button>
                <Button type="button" variant="outline" size="icon" disabled={!barcode} title={tm("printBarcode")} aria-label={tm("printBarcode")}
                  onClick={() => window.open(barcodeLabelUrl({ barcode: barcode ?? "", name: form.getValues("name"), priceDetail: parseAmount(form.getValues("priceDetail")) }, 1), "_blank", "noopener")}>
                  <Barcode />
                </Button>
              </div>
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

          <div className="space-y-4 rounded-xl border p-4 sm:col-span-2">
            <h3 className="text-sm font-semibold">{tm("pricesAndStock")}</h3>
            {product?.lastPurchase && (
              <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                {tm("lastPurchase", {
                  date: product.lastPurchase.date ? formatDate(product.lastPurchase.date, locale) : "—",
                  supplier: product.lastPurchase.supplier ?? "—",
                  cost: formatNumber(product.lastPurchase.unitCost, locale, 2),
                })}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-4">
              {num("purchasePrice", tm("purchasePrice"), e.purchasePrice?.message)}
              {num("priceDetail", tm("priceDetail"), e.priceDetail?.message)}
              {num("priceReseller", tm("priceReseller"), e.priceReseller?.message)}
              {num("priceWholesale", tm("priceWholesale"), e.priceWholesale?.message)}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {product
                ? <Field label={tm("currentStock")}><div className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm">{formatNumber(product.stockQuantity, locale)} {product.unit.symbol}</div></Field>
                : num("stockQuantity", tm("initialStock"), e.stockQuantity?.message)}
              {num("minStockAlert", tm("minStockAlert"), e.minStockAlert?.message)}
              <Controller control={form.control} name="isVisibleOnWebsite" render={({ field }) => (
                <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm sm:col-span-2">
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  <span>{tm("showOnWebsite")}</span>
                </label>
              )} />
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
