"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, Eye, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deleteRecipeAction, duplicateRecipeAction } from "@/actions/recipes";

export function useRecipeOps() {
  const t = useTranslations("recipes");
  const router = useRouter();
  const feedback = useActionFeedback();
  return {
    async duplicate(id: string, navigate = false) {
      const res = await duplicateRecipeAction(id);
      if (!res.ok) return feedback.error(res);
      toast.success(t("duplicated", { name: res.data!.name }));
      if (navigate) router.push(`/admin/recipes/${res.data!.id}/edit`);
      router.refresh();
    },
    async remove(id: string, after?: string) {
      const res = await deleteRecipeAction(id);
      if (!res.ok) {
        feedback.error(res);
        return false;
      }
      toast.success(t("deleted"));
      if (after) router.push(after);
      router.refresh();
    },
  };
}

/** Row/card dropdown menu: view, edit, duplicate, delete. */
export function RecipeRowMenu({ id, name }: { id: string; name: string }) {
  const t = useTranslations("recipes");
  const tc = useTranslations("common");
  const ops = useRecipeOps();
  const can = useCan();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${tc("actions")} — ${name}`}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link href={`/admin/recipes/${id}`}><Eye />{tc("view")}</Link></DropdownMenuItem>
          {can("recipes.edit") && <DropdownMenuItem asChild><Link href={`/admin/recipes/${id}/edit`}><Pencil />{tc("edit")}</Link></DropdownMenuItem>}
          {can("recipes.create") && <DropdownMenuItem onSelect={() => ops.duplicate(id)}><Copy />{t("duplicate")}</DropdownMenuItem>}
          <DropdownMenuSeparator />
          {can("recipes.delete") && <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 />{tc("delete")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={tc("deleteConfirmTitle")}
        description={<>{tc("deleteConfirmText", { name })} {t("deleteWarning")}</>}
        onConfirm={() => ops.remove(id)} />
    </>
  );
}

/** Buttons for the detail page header. */
export function RecipeDetailActions({ id, name }: { id: string; name: string }) {
  const t = useTranslations("recipes");
  const tc = useTranslations("common");
  const ops = useRecipeOps();
  const can = useCan();
  const [busy, setBusy] = useState(false);
  return (
    <>
      {can("recipes.create") && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); await ops.duplicate(id, true); setBusy(false); }}>
        {busy ? <Loader2 className="animate-spin" /> : <Copy />}{t("duplicate")}
      </Button>}
      {can("recipes.delete") && <ConfirmDialog
        trigger={<Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 />{tc("delete")}</Button>}
        title={tc("deleteConfirmTitle")}
        description={<>{tc("deleteConfirmText", { name })} {t("deleteWarning")}</>}
        onConfirm={() => ops.remove(id, "/admin/recipes")}
      />}
      {can("recipes.edit") && <Button asChild><Link href={`/admin/recipes/${id}/edit`}><Pencil />{tc("edit")}</Link></Button>}
    </>
  );
}
