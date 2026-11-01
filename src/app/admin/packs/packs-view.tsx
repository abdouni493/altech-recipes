"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, Boxes, Languages, Loader2, Package, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Textarea } from "@/components/ui/basic";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Field, FieldError } from "@/components/shared/form-fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { RecipeMultiSelect } from "@/components/shared/recipe-multi-select";
import { ProductMultiSelect } from "@/components/shared/product-multi-select";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deletePackAction, savePackAction } from "@/actions/packs";
import { packSchema, type PackInput } from "@/lib/schemas";
import type { RecipeLiteDTO } from "@/lib/dto";
import type { SupplierProductDTO } from "@/lib/suppliers";
import { cn } from "@/lib/utils";
import { ldesc, lname } from "@/lib/i18n-data";

export type PackRow = {
  id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null;
  recipes: RecipeLiteDTO[]; products: (SupplierProductDTO & { quantity: number })[]; clients: number; price: number | null;
};

type PackFilter = "all" | "recipes" | "products";

export function PacksView({ packs, recipes, products }: { packs: PackRow[]; recipes: RecipeLiteDTO[]; products: SupplierProductDTO[] }) {
  const ts = useTranslations("shop");
  const t = useTranslations("packs");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const can = useCan();
  const params = useSearchParams();
  const feedback = useActionFeedback();
  const [editing, setEditing] = useState<PackRow | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = params.get("edit");
    if (!id) return;
    const p = packs.find((x) => x.id === id);
    if (p) { setEditing(p); setOpen(true); }
    router.replace("/admin/packs");
  }, [params, packs, router]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const [filter, setFilter] = useState<PackFilter>("all");
  const shown = packs.filter((p) => filter === "all" || (filter === "recipes" ? p.recipes.length > 0 : p.products.length > 0));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {packs.length > 0 && (["all", "recipes", "products"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={cn("rounded-full border px-3 py-1 text-sm font-medium transition", filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/50")}>
            {ts(`packs.${f}`)}
          </button>
        ))}
        {can("packs.create") && <Button className="ms-auto" onClick={openNew}><Plus />{t("new")}</Button>}
      </div>
      {packs.length === 0 ? (
        <EmptyState icon={<Boxes />} title={t("emptyTitle")} description={t("emptyText")} action={can("packs.create") ? <Button onClick={openNew}><Plus />{t("new")}</Button> : undefined} />
      ) : (
        <Stagger className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <StaggerItem key={p.id}>
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="relative overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-sage-soft to-accent"><Boxes className="h-12 w-12 text-primary" /></div>}
                  <div className="absolute start-3 top-3 flex flex-wrap gap-1">
                    {p.recipes.length > 0 && <Badge variant="lemon" className="shadow-sm"><BookOpen className="h-3 w-3" />{tc("recipesCount", { count: p.recipes.length })}</Badge>}
                    {p.products.length > 0 && <Badge variant="secondary" className="shadow-sm"><Package className="h-3 w-3" />{ts("packForm.productsCount", { count: p.products.length })}</Badge>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h3 className="font-serif text-xl font-semibold">{lname(p, locale)}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ldesc(p, locale)}</p>
                  </div>
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {[...p.recipes, ...p.products].slice(0, 6).map((r) => (
                      r.imageUrl
                        ? <img key={r.id} src={r.imageUrl} alt={lname(r, locale)} title={lname(r, locale)} className="h-9 w-9 rounded-full border-2 border-card object-cover" />
                        : <span key={r.id} className="h-9 w-9 rounded-full border-2 border-card bg-muted" />
                    ))}
                    {p.recipes.length + p.products.length > 6 && <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-secondary text-xs font-semibold">+{p.recipes.length + p.products.length - 6}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-4 w-4" />{t("clients", { count: p.clients })}</span>
                    <div className="flex gap-1">
                      {can("packs.edit") && <Button variant="ghost" size="icon-sm" aria-label={`${tc("edit")} ${p.name}`} onClick={() => { setEditing(p); setOpen(true); }}><Pencil /></Button>}
                      {can("packs.delete") && <ConfirmDialog
                        trigger={<Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`${tc("delete")} ${p.name}`}><Trash2 /></Button>}
                        title={tc("deleteConfirmTitle")}
                        description={<>{tc("deleteConfirmText", { name: lname(p, locale) })} {t("deleteWarning")}</>}
                        onConfirm={async () => {
                          const res = await deletePackAction(p.id);
                          if (!res.ok) return feedback.error(res);
                          toast.success(t("deleted"));
                          router.refresh();
                        }}
                      />}
                    </div>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <PackFormDialog open={open} onOpenChange={setOpen} pack={editing} recipes={recipes} products={products} onSaved={() => router.refresh()} />
    </>
  );
}

function PackFormDialog({ open, onOpenChange, pack, recipes, products, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; pack: PackRow | null; recipes: RecipeLiteDTO[]; products: SupplierProductDTO[]; onSaved: () => void;
}) {
  const ts = useTranslations("shop");
  const locale = useLocale();
  const t = useTranslations("packs");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const [showAr, setShowAr] = useState(false);
  const form = useForm<PackInput>({ resolver: zodResolver(packSchema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: pack?.name ?? "", nameAr: pack?.nameAr ?? "", description: pack?.description ?? "", descriptionAr: pack?.descriptionAr ?? "",
      imageUrl: pack?.imageUrl ?? null, price: pack?.price ?? null, recipeIds: pack?.recipes.map((r) => r.id) ?? [],
      products: pack?.products.map((p) => ({ productId: p.id, quantity: p.quantity })) ?? [],
    });
    setShowAr(Boolean(pack?.nameAr || pack?.descriptionAr));
  }, [open, pack, form]);

  async function submit(v: PackInput) {
    const res = await savePackAction(pack?.id ?? null, v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof PackInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(pack ? t("updated", { name: res.data!.name }) : t("created", { name: res.data!.name }));
    onOpenChange(false);
    onSaved();
  }

  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{pack ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
            <Field label={t("image")} htmlFor="pack-image">
              <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUpload id="pack-image" bucket="packs" preset="offer" value={field.value} onChange={field.onChange} aspect="aspect-square" />} />
            </Field>
            <div className="space-y-4">
              <Field label={t("name")} htmlFor="pack-name" error={e.name?.message}>
                <Input id="pack-name" placeholder={t("namePlaceholder")} {...form.register("name")} aria-invalid={!!e.name} />
              </Field>
              <Field label={t("description")} htmlFor="pack-description" optional optionalLabel={tc("optional")}>
                <Textarea id="pack-description" rows={3} placeholder={t("descriptionPlaceholder")} {...form.register("description")} />
              </Field>
              <Field label={tc("websitePrice")} htmlFor="pack-price" optional optionalLabel={tc("optional")} hint={tc("websitePriceHint")} error={e.price?.message}>
                <Input id="pack-price" inputMode="decimal" dir="ltr" placeholder="0" {...form.register("price")} />
              </Field>
              <div className="rounded-xl border bg-background/50">
                <button type="button" onClick={() => setShowAr((s) => !s)} aria-expanded={showAr} className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-medium">
                  <Languages className="h-4 w-4 text-primary" /><span className="flex-1">{tc("arabic")}</span>
                </button>
                {showAr && (
                  <div className="space-y-4 border-t p-4" dir="rtl" lang="ar">
                    <Field label={t("nameAr")} htmlFor="pack-nameAr"><Input id="pack-nameAr" {...form.register("nameAr")} /></Field>
                    <Field label={t("descriptionAr")} htmlFor="pack-descriptionAr"><Textarea id="pack-descriptionAr" rows={3} {...form.register("descriptionAr")} /></Field>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("recipes")}</p>
            <Controller control={form.control} name="recipeIds" render={({ field }) => (
              <RecipeMultiSelect recipes={recipes} value={field.value ?? []} onChange={field.onChange} invalid={!!e.recipeIds} />
            )} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{ts("packForm.products")}</p>
            <Controller control={form.control} name="products" render={({ field }) => {
              const rows = field.value ?? [];
              return (
                <div className="space-y-3">
                  <ProductMultiSelect products={products} value={rows.map((r) => r.productId)}
                    onChange={(ids) => field.onChange(ids.map((id) => rows.find((r) => r.productId === id) ?? { productId: id, quantity: 1 }))} />
                  {rows.length > 0 && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {rows.map((r, i) => {
                        const p = products.find((x) => x.id === r.productId);
                        return (
                          <li key={r.productId} className="flex items-center gap-2 rounded-lg border bg-background/60 p-2 text-sm">
                            <Package className="h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate">{p ? lname(p, locale) : r.productId}</span>
                            <label className="text-xs text-muted-foreground" htmlFor={`pp-${i}`}>{ts("packForm.quantity")}</label>
                            <Input id={`pp-${i}`} inputMode="decimal" dir="ltr" className="h-8 w-20" value={String(r.quantity)}
                              onChange={(ev) => field.onChange(rows.map((x, j) => (j === i ? { ...x, quantity: ev.target.value as unknown as number } : x)))} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }} />
            <FieldError message={e.recipeIds?.message ?? (e as { root?: { message?: string } }).root?.message} />
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
