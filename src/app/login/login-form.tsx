"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, ExternalLink, Loader2, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Separator } from "@/components/ui/primitives";
import { Field } from "@/components/shared/form-fields";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createFirstAdminAction, loginAction, logoutAction, type FirstAdminInput } from "@/actions/auth";
import { optionalEmail, passwordField, requiredText, usernameField, V } from "@/lib/validators";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, V.required),
  password: z.string().min(1, V.required),
});
type LoginValues = z.infer<typeof loginSchema>;

const adminSchema = z
  .object({
    name: requiredText(80),
    username: usernameField,
    email: optionalEmail.refine((v) => v !== "", V.required),
    password: passwordField,
    confirmPassword: z.string().min(1, V.required),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: V.passwordMismatch });

export function LoginForm({ callbackUrl, expired, canCreateAdmin }: { callbackUrl?: string; expired?: boolean; canCreateAdmin: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "setup">("login");
  // Hidden for good as soon as an admin account exists (checked again by the database on submit).
  const [setupAvailable, setSetupAvailable] = useState(canCreateAdmin);

  // Stale session (account removed or data restored): clear it silently.
  useEffect(() => {
    if (expired) void logoutAction();
  }, [expired]);

  function goHome(home: string) {
    const target = callbackUrl && callbackUrl.startsWith(home === "/client" ? "/client" : "/admin") ? callbackUrl : home;
    router.replace(target);
    router.refresh();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="w-full max-w-md">
      <AnimatePresence mode="wait">
        {mode === "login" ? (
          <motion.div key="login" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
            <div className="mb-8 space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">{t("welcome")}</p>
              <h1 className="font-serif text-4xl font-semibold">{t("title")}</h1>
              <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>
            <SignInForm onDone={(home) => { toast.success(t("success")); goHome(home); }} />
            {setupAvailable && (
              <>
                <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <Separator className="flex-1" />
                  {t("setupTitle")}
                  <Separator className="flex-1" />
                </div>
                <Button variant="outline" className="w-full" onClick={() => setMode("setup")}>
                  <ShieldPlus className="text-primary" />
                  {t("createAdmin")}
                </Button>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="setup" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
            <div className="mb-8 space-y-2">
              <Button variant="ghost" size="sm" className="-ms-3" onClick={() => setMode("login")}><ArrowLeft className="flip-rtl" />{t("backToLogin")}</Button>
              <h1 className="font-serif text-4xl font-semibold">{t("createAdmin")}</h1>
              <p className="text-muted-foreground">{t("setupSubtitle")}</p>
            </div>
            <AdminSetupForm
              onExists={() => { setSetupAvailable(false); setMode("login"); }}
              onDone={(home) => { setSetupAvailable(false); toast.success(t("adminCreated")); goHome(home); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Button asChild variant="link" className="mt-6 w-full">
        <a href="/" target="_blank" rel="noopener noreferrer">
          <ExternalLink />
          {t("visitWebsite")}
        </a>
      </Button>
    </motion.div>
  );
}

function PasswordInput({ id, autoComplete, invalid, placeholder, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} className="pe-11" aria-invalid={invalid} {...rest} />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-e-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={show ? t("hidePassword") : t("showPassword")}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SignInForm({ onDone }: { onDone: (home: string) => void }) {
  const t = useTranslations("auth");
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });
  const e = form.formState.errors;

  async function submit(values: LoginValues) {
    const res = await loginAction(values);
    if (!res.ok || !res.data) {
      toast.error(t("invalid"));
      form.setError("password", { message: "" });
      return;
    }
    onDone(res.data.home);
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
      <Field label={t("username")} htmlFor="identifier" error={e.identifier?.message}>
        <Input id="identifier" autoComplete="username" autoCapitalize="none" dir="ltr" placeholder={t("usernamePlaceholder")}
          aria-invalid={!!e.identifier} {...form.register("identifier")} />
      </Field>
      <Field label={t("password")} htmlFor="password" error={e.password?.message || undefined}>
        <PasswordInput id="password" autoComplete="current-password" placeholder={t("passwordPlaceholder")} invalid={!!e.password} {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
        {form.formState.isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

function AdminSetupForm({ onDone, onExists }: { onDone: (home: string) => void; onExists: () => void }) {
  const t = useTranslations("auth");
  const feedback = useActionFeedback();
  const form = useForm<FirstAdminInput>({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: "", username: "", email: "", password: "", confirmPassword: "" },
  });
  const e = form.formState.errors;

  async function submit(values: FirstAdminInput) {
    const res = await createFirstAdminAction(values);
    if (!res.ok) {
      if (res.error === "auth.adminExists") {
        toast.error(t("adminExists"));
        return onExists();
      }
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof FirstAdminInput, { message: m }));
      return feedback.error(res);
    }
    onDone(res.data?.home ?? "/admin");
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
      <Field label={t("adminName")} htmlFor="s-name" error={e.name?.message}>
        <Input id="s-name" autoComplete="name" aria-invalid={!!e.name} {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("username")} htmlFor="s-username" error={e.username?.message}>
          <Input id="s-username" dir="ltr" autoComplete="username" autoCapitalize="none" aria-invalid={!!e.username} {...form.register("username")} />
        </Field>
        <Field label={t("email")} htmlFor="s-email" error={e.email?.message}>
          <Input id="s-email" type="email" dir="ltr" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
        </Field>
      </div>
      <Field label={t("password")} htmlFor="s-password" error={e.password?.message}>
        <PasswordInput id="s-password" autoComplete="new-password" invalid={!!e.password} {...form.register("password")} />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="s-confirm" error={e.confirmPassword?.message}>
        <PasswordInput id="s-confirm" autoComplete="new-password" invalid={!!e.confirmPassword} {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <ShieldPlus />}
        {t("createAdmin")}
      </Button>
    </form>
  );
}
