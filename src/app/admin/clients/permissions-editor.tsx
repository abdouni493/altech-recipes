"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Boxes, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/primitives";
import { Thumb } from "@/components/shared/thumb";
import type { RecipeLiteDTO } from "@/lib/dto";
import { lname } from "@/lib/i18n-data";
import { cn } from "@/lib/utils";

export type PackWithRecipes = { id: string; name: string; nameAr: string; imageUrl: string | null; recipeIds: string[] };

/** recipeId → source packId (null = individual recipe). */
export type PermissionState = { packs: string[]; recipes: Record<string, string | null> };

export function permissionsToState(perms: { recipeId: string; packId: string | null }[]): PermissionState {
  return {
    packs: Array.from(new Set(perms.map((p) => p.packId).filter(Boolean))) as string[],
    recipes: Object.fromEntries(perms.map((p) => [p.recipeId, p.packId])),
  };
}

export function stateToPermissions(state: PermissionState) {
  return Object.entries(state.recipes).map(([recipeId, packId]) => ({ recipeId, packId }));
}

export function PermissionsEditor({ packs, recipes, value, onChange }: { packs: PackWithRecipes[]; recipes: RecipeLiteDTO[]; value: PermissionState; onChange: (s: PermissionState) => void }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const locale = useLocale();
  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const selectedPacks = packs.filter((p) => value.packs.includes(p.id));
  const coveredByPacks = new Set(selectedPacks.flatMap((p) => p.recipeIds));
  const individuals = recipes.filter((r) => !coveredByPacks.has(r.id));
  const count = Object.keys(value.recipes).length;

  function togglePack(pack: PackWithRecipes, on: boolean) {
    const recipesNext = { ...value.recipes };
    if (on) {
      for (const id of pack.recipeIds) if (!(id in recipesNext) || recipesNext[id] === null) recipesNext[id] = pack.id;
      onChange({ packs: [...value.packs, pack.id], recipes: recipesNext });
    } else {
      const otherPacks = selectedPacks.filter((p) => p.id !== pack.id);
      for (const id of pack.recipeIds) {
        if (recipesNext[id] !== pack.id) continue;
        const other = otherPacks.find((p) => p.recipeIds.includes(id));
        if (other) recipesNext[id] = other.id;
        else delete recipesNext[id];
      }
      onChange({ packs: value.packs.filter((p) => p !== pack.id), recipes: recipesNext });
    }
  }

  function toggleRecipe(recipeId: string, packId: string | null, on: boolean) {
    const recipesNext = { ...value.recipes };
    if (on) recipesNext[recipeId] = packId;
    else delete recipesNext[recipeId];
    onChange({ ...value, recipes: recipesNext });
  }

  function setPackRecipes(pack: PackWithRecipes, on: boolean) {
    const recipesNext = { ...value.recipes };
    for (const id of pack.recipeIds) {
      if (on) recipesNext[id] = recipesNext[id] ?? pack.id;
      else if (recipesNext[id] === pack.id) delete recipesNext[id];
    }
    onChange({ ...value, recipes: recipesNext });
  }

  function selectEverything(on: boolean) {
    if (!on) return onChange({ packs: [], recipes: {} });
    const recipesNext: Record<string, string | null> = {};
    for (const p of packs) for (const id of p.recipeIds) if (!(id in recipesNext)) recipesNext[id] = p.id;
    for (const r of recipes) if (!(r.id in recipesNext)) recipesNext[r.id] = null;
    onChange({ packs: packs.map((p) => p.id), recipes: recipesNext });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sage-soft/60 p-3">
        <span className="flex items-center gap-2 text-sm font-medium"><ListChecks className="h-4 w-4 text-primary" />{tc("recipesCount", { count })}</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => selectEverything(true)}>{t("selectAllGlobal")}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => selectEverything(false)} disabled={count === 0}>{t("deselectAllGlobal")}</Button>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-serif text-lg font-semibold">{t("packs")}</h3>
          <p className="text-sm text-muted-foreground">{t("packsHint")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packs.map((pack) => {
            const on = value.packs.includes(pack.id);
            return (
              <label key={pack.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 transition-all hover:border-primary/60", on && "border-primary bg-sage-soft/40 ring-2 ring-primary/15")}>
                <Checkbox checked={on} onCheckedChange={(c) => togglePack(pack, c === true)} aria-label={pack.name} />
                {pack.imageUrl ? <img src={pack.imageUrl} alt="" className="h-11 w-11 rounded-lg object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-lg bg-muted"><Boxes className="h-5 w-5 text-muted-foreground" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{lname(pack, locale)}</span>
                  <span className="text-xs text-muted-foreground">{tc("recipesCount", { count: pack.recipeIds.length })}</span>
                </span>
              </label>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {selectedPacks.map((pack) => {
            const checked = pack.recipeIds.filter((id) => id in value.recipes).length;
            const all = checked === pack.recipeIds.length;
            return (
              <motion.div key={pack.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-xl border bg-background/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{lname(pack, locale)} <span className="text-sm font-normal text-muted-foreground">({checked}/{pack.recipeIds.length})</span></span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPackRecipes(pack, !all)}>{all ? tc("deselectAll") : tc("selectAll")}</Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {pack.recipeIds.map((rid) => {
                      const r = recipeMap.get(rid);
                      if (!r) return null;
                      const on = rid in value.recipes;
                      return (
                        <label key={rid} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 hover:bg-secondary">
                          <Checkbox checked={on} onCheckedChange={(c) => toggleRecipe(rid, value.recipes[rid] ?? pack.id, c === true)} aria-label={r.name} />
                          <Thumb src={r.imageUrl} className="h-8 w-8" />
                          <span className="truncate text-sm">{lname(r, locale)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-serif text-lg font-semibold">{t("individualRecipes")}</h3>
          <p className="text-sm text-muted-foreground">{t("individualHint")}</p>
        </div>
        {individuals.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t("allRecipesSelected")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {individuals.map((r) => {
              const on = r.id in value.recipes;
              return (
                <label key={r.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card p-2 transition-colors hover:border-primary/60", on && "border-primary bg-sage-soft/40")}>
                  <Checkbox checked={on} onCheckedChange={(c) => toggleRecipe(r.id, null, c === true)} aria-label={r.name} />
                  <Thumb src={r.imageUrl} className="h-9 w-9" />
                  <span className="truncate text-sm font-medium">{lname(r, locale)}</span>
                </label>
              );
            })}
          </div>
        )}
      </section>
      {count === 0 && <p className="text-sm text-warning">{t("noPermissions")}</p>}
    </div>
  );
}
