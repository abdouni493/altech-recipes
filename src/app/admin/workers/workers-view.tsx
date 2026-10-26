"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Input } from "@/components/ui/basic";
import { Checkbox } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/page-header";
import { Field } from "@/components/shared/form-fields";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createWorkerAction, deleteWorkerAction, updateWorkerAction, type WorkerInput } from "@/actions/workers";
import { PERMISSION_GROUPS, type PermissionGroup } from "@/lib/permissions";

export type WorkerRow = { id: string; name: string; username: string; email: string; permissions: string[] };

export function WorkersView({ workers }: { workers: WorkerRow[] }) {
  const t = useTranslations("workers");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();
  const [editing, setEditing] = useState<WorkerRow | null>(null);
  const [open, setOpen] = useState(false);

  const openForm = (w: WorkerRow | null) => { setEditing(w); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openForm(null)}><Plus />{t("new")}</Button>
      </div>
      {workers.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((w) => (
            <Card key={w.id}>
              <CardContent className="space-y-3 pt-6 sm:pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{w.name}</div>
                    <div className="truncate font-mono text-xs text-muted-foreground" dir="ltr">{w.username}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => openForm(w)} aria-label={tc("edit")}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon-sm" variant="ghost" aria-label={tc("delete")}><Trash2 className="text-destructive" /></Button>}
                      title={t("deleteTitle", { name: w.name })}
                      description={t("deleteText")}
                      confirmLabel={tc("delete")}
                      onConfirm={async () => {
                        const res = await deleteWorkerAction(w.id);
                        if (!res.ok) { feedback.error(res); return false; }
                        toast.success(t("deleted"));
                        router.refresh();
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {w.permissions.length === 0 && <span className="text-xs text-muted-foreground">{t("noPermissions")}</span>}
                  {w.permissions.map((p) => <Badge key={p} variant="secondary">{t(`perm.${p.replace(".", "_")}` as never)}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <WorkerDialog open={open} onOpenChange={setOpen} worker={editing} onSaved={() => { setOpen(false); router.refresh(); }} />
    </div>
  );
}

function WorkerDialog({ open, onOpenChange, worker, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; worker: WorkerRow | null; onSaved: () => void;
}) {
  const t = useTranslations("workers");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const form = useForm<WorkerInput>({
    values: { name: worker?.name ?? "", username: worker?.username ?? "", email: worker?.email ?? "", password: "", permissions: worker?.permissions ?? [] },
  });
  const e = form.formState.errors;

  async function submit(v: WorkerInput) {
    const res = worker ? await updateWorkerAction(worker.id, v) : await createWorkerAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof WorkerInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("saved"));
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{worker ? t("editTitle") : t("new")}</DialogTitle>
          <DialogDescription>{t("formHint")}</DialogDescription>
        </DialogHeader>
        <form id="worker-form" onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="w-name" error={e.name?.message}><Input id="w-name" {...form.register("name")} /></Field>
            <Field label={t("username")} htmlFor="w-username" error={e.username?.message}><Input id="w-username" dir="ltr" autoCapitalize="none" {...form.register("username")} /></Field>
            <Field label={t("email")} htmlFor="w-email" optional optionalLabel={tc("optional")} error={e.email?.message}><Input id="w-email" type="email" dir="ltr" {...form.register("email")} /></Field>
            <Field label={worker ? t("newPassword") : t("password")} htmlFor="w-password" hint={worker ? t("passwordKeep") : undefined} error={e.password?.message}>
              <Input id="w-password" type="text" dir="ltr" autoComplete="new-password" {...form.register("password")} />
            </Field>
          </div>
          <Controller control={form.control} name="permissions" render={({ field }) => {
            const set = new Set(field.value);
            const toggle = (p: string, on: boolean) => {
              if (on) set.add(p); else set.delete(p);
              field.onChange(Array.from(set));
            };
            return (
              <div className="space-y-3">
                <div className="text-sm font-medium">{t("permissions")}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(PERMISSION_GROUPS) as PermissionGroup[]).map((g) => (
                    <div key={g} className="rounded-xl border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(`group.${g}` as never)}</div>
                      <div className="space-y-2">
                        {PERMISSION_GROUPS[g].map((p) => (
                          <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={set.has(p)} onCheckedChange={(c) => toggle(p, c === true)} />
                            {t(`perm.${p.replace(".", "_")}` as never)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button type="submit" form="worker-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}{tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
