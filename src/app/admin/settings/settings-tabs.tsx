"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Database, Download, FileArchive, KeyRound, Loader2, Save, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui/basic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Field } from "@/components/shared/form-fields";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { updateAdminPasswordAction, updateAdminProfileAction } from "@/actions/settings";
import { adminPasswordSchema, adminProfileSchema, type AdminPasswordInput, type AdminProfileInput } from "@/lib/settings-schemas";

export function SettingsTabs({ profile, lastBackup, stats, isAdmin }: {
  profile: AdminProfileInput; lastBackup: string | null; isAdmin: boolean; stats: { recipes: number; products: number; clients: number; orders: number };
}) {
  const t = useTranslations("settings");
  return (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account"><UserRound />{t("tabs.account")}</TabsTrigger>
        {isAdmin && <TabsTrigger value="database"><Database />{t("tabs.database")}</TabsTrigger>}
      </TabsList>
      <TabsContent value="account">
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileForm initial={profile} />
          <PasswordForm />
        </div>
      </TabsContent>
      {isAdmin && <TabsContent value="database"><DatabasePanel lastBackup={lastBackup} stats={stats} /></TabsContent>}
    </Tabs>
  );
}

function ProfileForm({ initial }: { initial: AdminProfileInput }) {
  const t = useTranslations("settings.account");
  const tc = useTranslations("common");
  const router = useRouter();
  const feedback = useActionFeedback();
  const form = useForm<AdminProfileInput>({ resolver: zodResolver(adminProfileSchema), defaultValues: initial });
  const e = form.formState.errors;
  async function submit(v: AdminProfileInput) {
    const res = await updateAdminProfileAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof AdminProfileInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("saved"));
    router.refresh();
  }
  return (
    <Card>
      <CardHeader><CardTitle>{t("profile")}</CardTitle><CardDescription>{t("profileHint")}</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label={t("name")} htmlFor="a-name" error={e.name?.message}><Input id="a-name" {...form.register("name")} aria-invalid={!!e.name} /></Field>
          <Field label={t("username")} htmlFor="a-username" error={e.username?.message}><Input id="a-username" dir="ltr" autoComplete="username" {...form.register("username")} aria-invalid={!!e.username} /></Field>
          <Field label={t("email")} htmlFor="a-email" optional optionalLabel={tc("optional")} error={e.email?.message}><Input id="a-email" type="email" dir="ltr" {...form.register("email")} aria-invalid={!!e.email} /></Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}{tc("save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const t = useTranslations("settings.account");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const form = useForm<AdminPasswordInput>({ resolver: zodResolver(adminPasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const e = form.formState.errors;
  async function submit(v: AdminPasswordInput) {
    const res = await updateAdminPasswordAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof AdminPasswordInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("passwordSaved"));
    form.reset();
  }
  return (
    <Card>
      <CardHeader><CardTitle>{t("password")}</CardTitle><CardDescription>{t("passwordHint")}</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label={t("currentPassword")} htmlFor="a-cur" error={e.currentPassword?.message}><Input id="a-cur" type="password" autoComplete="current-password" {...form.register("currentPassword")} aria-invalid={!!e.currentPassword} /></Field>
          <Field label={t("newPassword")} htmlFor="a-new" error={e.newPassword?.message}><Input id="a-new" type="password" autoComplete="new-password" {...form.register("newPassword")} aria-invalid={!!e.newPassword} /></Field>
          <Field label={t("confirmPassword")} htmlFor="a-confirm" error={e.confirmPassword?.message}><Input id="a-confirm" type="password" autoComplete="new-password" {...form.register("confirmPassword")} aria-invalid={!!e.confirmPassword} /></Field>
          <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <KeyRound />}{tc("save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function DatabasePanel({ lastBackup, stats }: { lastBackup: string | null; stats: { recipes: number; products: number; clients: number; orders: number } }) {
  const t = useTranslations("settings.db");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "backup.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("backupDone"));
      router.refresh();
    } catch {
      toast.error(t("invalidFile"));
    } finally {
      setDownloading(false);
    }
  }

  async function restore() {
    if (!file) return;
    setRestoring(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/restore", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setRestoring(false);
    if (!res.ok) {
      toast.error(t("invalidFile"));
      return;
    }
    toast.success(t("restored", { count: json.count }), { description: t("relogin") });
    setFile(null);
    // If the current admin is not part of the restored data, the admin guard sends us back to the login page.
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" />{t("backupTitle")}</CardTitle>
          <CardDescription>{t("backupText")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-secondary p-4 text-sm">
            <div className="font-medium">{t("stats")}</div>
            <div className="text-muted-foreground">{t("statsLine", stats)}</div>
          </div>
          <p className="text-sm text-muted-foreground">{lastBackup ? t("lastBackup", { date: lastBackup }) : t("neverBackedUp")}</p>
          <Button onClick={download} disabled={downloading}>{downloading ? <Loader2 className="animate-spin" /> : <Download />}{downloading ? t("downloading") : t("download")}</Button>
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-destructive" />{t("restoreTitle")}</CardTitle>
          <CardDescription>{t("restoreText")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input ref={inputRef} type="file" accept=".zip,application/zip" className="sr-only" id="restore-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="outline" onClick={() => inputRef.current?.click()}><FileArchive />{t("chooseFile")}</Button>
          {file && <p className="text-sm">{t("selectedFile", { name: file.name, size: formatSize(file.size) })}</p>}
          <div className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t("confirmText")}</div>
          <Button variant="destructive" disabled={!file || restoring} onClick={() => setConfirm(true)}>
            {restoring ? <Loader2 className="animate-spin" /> : <Upload />}{restoring ? t("restoring") : t("restore")}
          </Button>
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t("confirmTitle")} description={t("confirmText")} confirmLabel={t("confirmButton")} onConfirm={restore} />
        </CardContent>
      </Card>
    </div>
  );
}
