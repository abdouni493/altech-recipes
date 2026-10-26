"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/basic";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { updatePermissionsAction } from "@/actions/clients";
import type { RecipeLiteDTO } from "@/lib/dto";
import { PermissionsEditor, permissionsToState, stateToPermissions, type PackWithRecipes } from "../../permissions-editor";

export function PermissionsForm({ clientId, packs, recipes, initial }: { clientId: string; packs: PackWithRecipes[]; recipes: RecipeLiteDTO[]; initial: { recipeId: string; packId: string | null }[] }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();
  const [state, setState] = useState(() => permissionsToState(initial));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updatePermissionsAction(clientId, { permissions: stateToPermissions(state) });
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    toast.success(t("permissionsUpdated", { count: res.data!.count }));
    router.push(`/admin/clients/${clientId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card><CardContent className="pt-6 sm:pt-6"><PermissionsEditor packs={packs} recipes={recipes} value={state} onChange={setState} /></CardContent></Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>{tc("cancel")}</Button>
        <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{tc("save")}</Button>
      </div>
    </div>
  );
}
