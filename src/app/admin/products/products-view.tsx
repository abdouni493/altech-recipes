"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Barcode, Boxes, Coins, Eye, EyeOff, FlaskConical, Globe, History, Info, Languages, Loader2, MoreHorizontal, PackageCheck, PackageX, Pencil, Plus, Printer,
  Shuffle, Tag, Trash2, Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Textarea } from "@/components/ui/basic";
import { Switch } from "@/components/ui/primitives";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/overlays";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Field, useErrorText } from "@/components/shared/form-fields";
import { CategorySelect } from "@/components/shared/category-select";
import { ImageUpload } from "@/components/shared/image-upload";
import { ManageUnitsDialog, UnitSelect, useUnits } from "@/components/shared/units";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { Money } from "@/components/commerce/shared";
import { deleteProductAction, saveProductAction } from "@/actions/products";
import { adjustStockAction, barcodeTakenAction, setProductFlagAction } from "@/actions/commerce";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { formatMoney, generateEan13, parseAmount, type CommerceProductDTO } from "@/lib/commerce";
import type { CategoryDTO } from "@/lib/categories";
import type { ProductDTO } from "@/lib/dto";
import { formatDate, formatNumber } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { cn, normalizeSearch } from "@/lib/utils";
import { ProductHistoryDialog } from "./product-history-dialog";

export type StockProductDTO = ProductDTO & Omit<CommerceProductDTO, "unitSymbol"> & {
  lastPurchase: { date: string | null; supplier: string | null; unitCost: number } | null;
  categoryId: string | null;
  tiers: { id: string; quantity: number; price: number }[];
};

export function barcodeLabelUrl(p: { barcode: string | null; name: string; priceDetail: number }, count = 1) {
  const qs = new URLSearchParams({ code: p.barcode ?? "", name: p.name, price: String(p.priceDetail), n: String(count) });
  return `/print/barcode?${qs}`;
}

export function ProductsView({ products, categories }: { products: StockProductDTO[]; categories: CategoryDTO[] }) {
  const can = useCan();
  const t = useTranslations("products");
  const tm = useTranslations("commerce");
  const ts = useTranslations("shop");
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
  const [category, setCategory] = useState("all");
  const categoryName = (id: string | null) => { const c = categories.find((x) => x.id === id); return c ? lname(c, locale) : null; };

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
  const rows = useMemo(() => products.filter((p) => (!lowOnly || isLow(p)) && (category === "all" || p.categoryId === category)), [products, lowOnly, category]);
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
              {categoryName(p.categoryId) && <Badge variant="outline"><Tag className="h-3 w-3" />{categoryName(p.categoryId)}</Badge>}
              {p.tiers.length > 0 && <Badge variant="lemon">{p.tiers.length} × {ts("offers")}</Badge>}
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
  ], [locale, t, tc, tm, ts, can, categories]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {categories.length > 0 && (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-44" aria-label={ts("category")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ts("all")}</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{lname(c, locale)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
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
      <ProductFormDialog open={open} onOpenChange={setOpen} product={editing} categories={categories} onSaved={() => router.refresh()} />
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

function Section({ icon: Icon, title, hint, children, className }: { icon: typeof Tag; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5", className)}>
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-soft text-primary"><Icon className="h-4 w-4" /></span>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Quantity offers: each row keeps the total price; editing the unit price recalculates it. */
function TiersEditor({ form, unitSymbol, unitPrice }: { form: UseFormReturn<ProductInput>; unitSymbol: string; unitPrice: number }) {
  const t = useTranslations("shop.tiers");
  const locale = useLocale();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "tiers" });
  const tiers = form.watch("tiers") ?? [];
  const err = form.formState.errors.tiers as { message?: string; root?: { message?: string } } | undefined;
  const errText = useErrorText()(err?.message ?? err?.root?.message);
  const unit = unitSymbol || "u";

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{t("hint", { unit })}</p>
      {fields.length === 0 && <p className="text-center text-sm text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-2">
        {fields.map((f, i) => {
          const qty = parseAmount(tiers[i]?.quantity);
          const total = parseAmount(tiers[i]?.price);
          const per = qty > 0 ? total / qty : 0;
          const full = unitPrice * qty;
          const saving = full > 0 && total < full ? Math.round(((full - total) / full) * 100) : 0;
          return (
            <li key={f.id} className="grid grid-cols-2 items-end gap-2 rounded-xl border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label={t("quantity", { unit })} htmlFor={`tier-q-${i}`}>
                <Input id={`tier-q-${i}`} inputMode="decimal" dir="ltr" {...form.register(`tiers.${i}.quantity` as const)} placeholder="5" />
              </Field>
              <Field label={t("total")} htmlFor={`tier-p-${i}`}>
                <Input id={`tier-p-${i}`} inputMode="decimal" dir="ltr" {...form.register(`tiers.${i}.price` as const)} placeholder="4000" />
              </Field>
              <Field label={t("unitPrice", { unit })} htmlFor={`tier-u-${i}`}>
                <Input id={`tier-u-${i}`} inputMode="decimal" dir="ltr" key={`${f.id}-${qty}`} defaultValue={per ? String(Math.round(per * 100) / 100) : ""}
                  onChange={(e) => { const v = parseAmount(e.target.value); if (qty > 0) form.setValue(`tiers.${i}.price`, String(Math.round(v * qty * 100) / 100) as never, { shouldDirty: true }); }} />
              </Field>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                {saving > 0 ? <Badge variant="lemon">{t("saving")} -{saving}%</Badge> : <span className="text-xs text-muted-foreground">{qty > 0 ? formatMoney(total, locale) : ""}</span>}
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => remove(i)} aria-label={t("remove")}><Trash2 /></Button>
              </div>
            </li>
          );
        })}
      </ul>
      {errText && <p className="text-xs font-medium text-destructive">{errText}</p>}
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => append({ quantity: "" as unknown as number, price: "" as unknown as number })}><Plus />{t("add")}</Button>
    </div>
  );
}

function ProductFormDialog({ open, onOpenChange, product, categories, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; product: StockProductDTO | null; categories: CategoryDTO[]; onSaved: () => void;
}) {
  const t = useTranslations("products");
  const tm = useTranslations("commerce");
  const ts = useTranslations("shop");
  const tc = useTranslations("common");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const { units } = useUnits();
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
      isVisibleOnWebsite: product?.isVisibleOnWebsite ?? true, categoryId: product?.categoryId ?? null,
      tiers: product?.tiers.map((x) => ({ quantity: x.quantity, price: x.price })) ?? [],
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
  const unitSymbol = units.find((u) => u.id === form.watch("unitId"))?.symbol ?? "";
  const detail = parseAmount(form.watch("priceDetail"));
  const cost = parseAmount(form.watch("purchasePrice"));
  const num = (name: keyof ProductInput, label: string, error?: string) => (
    <Field label={label} htmlFor={`product-${name}`} error={error}>
      <Input id={`product-${name}`} inputMode="decimal" dir="ltr" {...form.register(name)} />
    </Field>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto bg-secondary/30 p-4 sm:p-6" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{product ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <Section icon={Info} title={ts("form.general")} hint={ts("form.generalHint")}>
            <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
              <Field label={t("image")} htmlFor="product-image">
                <Controller control={form.control} name="imageUrl" render={({ field }) => (
                  <ImageUpload id="product-image" bucket="products" preset="product" value={field.value} onChange={field.onChange} aspect="aspect-square" />
                )} />
              </Field>
              <div className="space-y-4">
                <Field label={t("name")} htmlFor="product-name" error={e.name?.message}>
                  <Input id="product-name" placeholder={t("namePlaceholder")} {...form.register("name")} aria-invalid={!!e.name} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("unit")} htmlFor="product-unit" error={e.unitId?.message}>
                    <Controller control={form.control} name="unitId" render={({ field }) => (
                      <UnitSelect id="product-unit" value={field.value} onChange={field.onChange} invalid={!!e.unitId} />
                    )} />
                  </Field>
                  <Field label={ts("category")} htmlFor="product-category" optional optionalLabel={tc("optional")}>
                    <Controller control={form.control} name="categoryId" render={({ field }) => (
                      <CategorySelect id="product-category" kind="PRODUCT" categories={categories} value={field.value} onChange={field.onChange} />
                    )} />
                  </Field>
                </div>
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
              </div>
            </div>
            <Field label={t("description")} htmlFor="product-description" optional optionalLabel={tc("optional")} error={e.description?.message}>
              <Textarea id="product-description" rows={2} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />
            </Field>
            <div className="rounded-xl border bg-background/50">
              <button type="button" onClick={() => setShowAr((s) => !s)} aria-expanded={showAr}
                className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-medium">
                <Languages className="h-4 w-4 text-primary" />
                <span className="flex-1">{t("arabicSection")}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:inline">{t("arabicHint")}</span>
              </button>
              {showAr && (
                <div className="space-y-4 border-t p-4" dir="rtl" lang="ar">
                  <Field label={t("nameAr")} htmlFor="product-nameAr" error={e.nameAr?.message}>
                    <Input id="product-nameAr" {...form.register("nameAr")} />
                  </Field>
                  <Field label={t("descriptionAr")} htmlFor="product-descriptionAr" error={e.descriptionAr?.message}>
                    <Textarea id="product-descriptionAr" rows={2} {...form.register("descriptionAr")} />
                  </Field>
                </div>
              )}
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section icon={Coins} title={ts("form.pricing")} hint={ts("form.pricingHint")}>
              {product?.lastPurchase && (
                <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  {tm("lastPurchase", {
                    date: product.lastPurchase.date ? formatDate(product.lastPurchase.date, locale) : "—",
                    supplier: product.lastPurchase.supplier ?? "—",
                    cost: formatNumber(product.lastPurchase.unitCost, locale, 2),
                  })}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {num("purchasePrice", tm("purchasePrice"), e.purchasePrice?.message)}
                {num("priceDetail", tm("priceDetail"), e.priceDetail?.message)}
                {num("priceReseller", tm("priceReseller"), e.priceReseller?.message)}
                {num("priceWholesale", tm("priceWholesale"), e.priceWholesale?.message)}
              </div>
              {detail > 0 && cost > 0 && (
                <p className={cn("text-xs font-medium", detail >= cost ? "text-success" : "text-destructive")}>
                  {ts("form.margin", { value: `${formatMoney(detail - cost, locale)} (${Math.round(((detail - cost) / cost) * 100)}%)` })}
                </p>
              )}
            </Section>

            <Section icon={Warehouse} title={ts("form.stock")} hint={ts("form.stockHint")}>
              <div className="grid grid-cols-2 gap-3">
                {product
                  ? <Field label={tm("currentStock")}><div className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm">{formatNumber(product.stockQuantity, locale)} {product.unit.symbol}</div></Field>
                  : num("stockQuantity", tm("initialStock"), e.stockQuantity?.message)}
                {num("minStockAlert", tm("minStockAlert"), e.minStockAlert?.message)}
              </div>
              <Controller control={form.control} name="isVisibleOnWebsite" render={({ field }) => (
                <label className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-3 text-sm">
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  <Globe className="h-4 w-4 text-primary" />
                  <span>{tm("showOnWebsite")}</span>
                </label>
              )} />
            </Section>
          </div>

          <Section icon={Tag} title={ts("tiers.title")}>
            <TiersEditor form={form} unitSymbol={unitSymbol} unitPrice={detail} />
          </Section>

          <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background/95 p-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
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
