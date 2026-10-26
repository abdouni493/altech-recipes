"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Facebook, Globe, ImagePlus, Instagram, Loader2, Mail, MapPin, MessageCircle, Phone, Save, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/basic";
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Field } from "@/components/shared/form-fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { Thumb } from "@/components/shared/thumb";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { setRecipeVisibilityAction } from "@/actions/recipes";
import { saveContactSettingsAction, saveSiteSettingsAction } from "@/actions/website";
import { contactSchema, siteSchema, type ContactInput, type SiteInput } from "@/lib/website-schemas";
import { ldesc, lname } from "@/lib/i18n-data";
import { excerpt } from "@/lib/utils";

type RecipeVis = { id: string; name: string; nameAr: string; description: string; descriptionAr: string; imageUrl: string | null; isVisibleOnWebsite: boolean };

export function WebsiteTabs({ initialTab, recipes, contact, site }: { initialTab: string; recipes: RecipeVis[]; contact: ContactInput; site: SiteInput }) {
  const t = useTranslations("website");
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v); router.replace(`/admin/website?tab=${v}`, { scroll: false }); }}>
      <TabsList>
        <TabsTrigger value="recipes"><Eye />{t("tabs.recipes")}</TabsTrigger>
        <TabsTrigger value="contacts"><Phone />{t("tabs.contacts")}</TabsTrigger>
        <TabsTrigger value="settings"><Settings2 />{t("tabs.settings")}</TabsTrigger>
      </TabsList>
      <TabsContent value="recipes"><RecipesVisibility recipes={recipes} /></TabsContent>
      <TabsContent value="contacts"><ContactForm initial={contact} /></TabsContent>
      <TabsContent value="settings"><SiteSettingsForm initial={site} /></TabsContent>
    </Tabs>
  );
}

function RecipesVisibility({ recipes }: { recipes: RecipeVis[] }) {
  const t = useTranslations("website");
  const can = useCan();
  const locale = useLocale();
  const router = useRouter();
  const feedback = useActionFeedback();
  const [state, setState] = useState<Record<string, boolean>>(() => Object.fromEntries(recipes.map((r) => [r.id, r.isVisibleOnWebsite])));
  const [busy, setBusy] = useState<string | null>(null);
  const visible = Object.values(state).filter(Boolean).length;

  async function toggle(r: RecipeVis) {
    const next = !state[r.id];
    setBusy(r.id);
    setState((s) => ({ ...s, [r.id]: next }));
    const res = await setRecipeVisibilityAction(r.id, next);
    setBusy(null);
    if (!res.ok) {
      setState((s) => ({ ...s, [r.id]: !next }));
      return feedback.error(res);
    }
    toast.success(next ? t("shownToast", { name: lname(r, locale) }) : t("hiddenToast", { name: lname(r, locale) }));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardDescription className="max-w-2xl">{t("recipesHint")}</CardDescription>
        <Badge variant="lemon">{t("visibleCount", { visible, total: recipes.length })}</Badge>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-xl border">
          {recipes.map((r) => {
            const on = state[r.id];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                <Thumb src={r.imageUrl} className={on ? "" : "opacity-50 grayscale"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{lname(r, locale)}</div>
                  <div className="truncate text-xs text-muted-foreground">{excerpt(ldesc(r, locale), 90)}</div>
                </div>
                <Badge variant={on ? "success" : "secondary"}>{on ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{on ? t("visible") : t("hidden")}</Badge>
                <Button size="sm" variant={on ? "outline" : "default"} disabled={busy === r.id || !can("recipes.edit")} onClick={() => toggle(r)} className="min-w-[10.5rem]">
                  {busy === r.id ? <Loader2 className="animate-spin" /> : on ? <EyeOff /> : <Eye />}
                  {on ? t("hide") : t("show")}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ContactForm({ initial }: { initial: ContactInput }) {
  const t = useTranslations("website.contacts");
  const can = useCan();
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const router = useRouter();
  const form = useForm<ContactInput>({ resolver: zodResolver(contactSchema), defaultValues: initial });
  const e = form.formState.errors;

  async function submit(v: ContactInput) {
    const res = await saveContactSettingsAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ContactInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("saved"));
    router.refresh();
  }

  const fields: { name: keyof ContactInput; icon: React.ReactNode; type?: string; hint?: string; placeholder?: string }[] = [
    { name: "phone", icon: <Phone />, type: "tel", placeholder: "0555 12 34 56" },
    { name: "whatsappNumber", icon: <MessageCircle />, type: "tel", hint: t("whatsappHint"), placeholder: "0555123456" },
    { name: "email", icon: <Mail />, type: "email", placeholder: "contact@exemple.dz" },
    { name: "mapsLocationUrl", icon: <MapPin />, type: "url", placeholder: "https://maps.google.com/…" },
    { name: "facebookUrl", icon: <Facebook />, type: "url", placeholder: "https://facebook.com/…" },
    { name: "instagramUrl", icon: <Instagram />, type: "url", placeholder: "https://instagram.com/…" },
    { name: "tiktokUrl", icon: <Globe />, type: "url", placeholder: "https://tiktok.com/@…" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
          <div className="grid gap-5 md:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.name} label={<span className="flex items-center gap-2 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-primary">{f.icon}{t(f.name)}</span>} htmlFor={`c-${f.name}`} hint={f.hint} error={e[f.name]?.message}>
                <Input id={`c-${f.name}`} type={f.type} dir="ltr" placeholder={f.placeholder} {...form.register(f.name)} aria-invalid={!!e[f.name]} />
              </Field>
            ))}
          </div>
          <div className="flex justify-end">
            {can("website.edit") && <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}{tc("save")}</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BilingualField({ form, name, label, multiline, rows = 3 }: {
  form: ReturnType<typeof useForm<SiteInput>>; name: "siteName" | "siteDescription" | "heroTitle" | "heroSubtitle" | "aboutText" | "howItWorks" | "ctaText" | "footerText" | "metaTitle" | "metaDescription";
  label: string; multiline?: boolean; rows?: number;
}) {
  const t = useTranslations("website.settings");
  const e = form.formState.errors;
  const fr = `${name}Fr` as keyof SiteInput;
  const ar = `${name}Ar` as keyof SiteInput;
  const Comp = multiline ? Textarea : Input;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t("fr")}</span>
          <Comp id={`s-${fr}`} lang="fr" dir="ltr" rows={multiline ? rows : undefined} aria-label={`${label} — ${t("fr")}`} {...form.register(fr as never)} aria-invalid={!!e[fr]} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t("ar")}</span>
          <Comp id={`s-${ar}`} lang="ar" dir="rtl" rows={multiline ? rows : undefined} aria-label={`${label} — ${t("ar")}`} {...form.register(ar as never)} aria-invalid={!!e[ar]} />
        </div>
      </div>
    </fieldset>
  );
}

function SiteSettingsForm({ initial }: { initial: SiteInput }) {
  const can = useCan();
  const t = useTranslations("website.settings");
  const tc = useTranslations("common");
  const feedback = useActionFeedback();
  const router = useRouter();
  const form = useForm<SiteInput>({ resolver: zodResolver(siteSchema), defaultValues: initial });
  const hero = form.watch("heroImages") ?? [];
  const [adding, setAdding] = useState(false);

  const setHero = (list: string[]) => form.setValue("heroImages", list, { shouldDirty: true });
  const move = (i: number, d: number) => {
    const list = [...hero];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    setHero(list);
  };

  async function submit(v: SiteInput) {
    const res = await saveSiteSettingsAction(v);
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof SiteInput, { message: m }));
      return feedback.error(res);
    }
    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(submit, () => toast.error(tc("genericError")))} className="space-y-6" noValidate>
      <Card>
        <CardHeader><CardTitle>{t("identity")}</CardTitle><CardDescription>{t("identityHint")}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <BilingualField form={form} name="siteName" label={t("siteName")} />
          <BilingualField form={form} name="siteDescription" label={t("siteDescription")} multiline rows={2} />
          <div className="flex flex-wrap gap-8">
            <Field label={t("logo")} htmlFor="s-logo">
              <Controller control={form.control} name="logoUrl" render={({ field }) => <ImageUpload id="s-logo" bucket="site" preset="logo" value={field.value} onChange={field.onChange} compact />} />
            </Field>
            <Field label={t("favicon")} htmlFor="s-favicon">
              <Controller control={form.control} name="faviconUrl" render={({ field }) => <ImageUpload id="s-favicon" bucket="site" preset="favicon" value={field.value} onChange={field.onChange} compact />} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("hero")}</CardTitle><CardDescription>{t("heroHint")}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("heroImages")}</p>
            {hero.length === 0 && <p className="text-sm text-warning">{t("noHeroImages")}</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hero.map((url, i) => (
                <div key={`${url}-${i}`} className="group relative overflow-hidden rounded-xl border">
                  <img src={url} alt="" className="aspect-video w-full object-cover" />
                  <span className="absolute start-2 top-2 rounded-full bg-background/90 px-2 text-xs font-semibold">{i + 1}</span>
                  <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1">
                    <Button type="button" size="icon-sm" variant="secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tc("moveUp")}><ArrowUp className="-rotate-90 rtl:rotate-90" /></Button>
                    <Button type="button" size="icon-sm" variant="secondary" disabled={i === hero.length - 1} onClick={() => move(i, 1)} aria-label={tc("moveDown")}><ArrowDown className="-rotate-90 rtl:rotate-90" /></Button>
                    <Button type="button" size="icon-sm" variant="destructive" onClick={() => setHero(hero.filter((_, j) => j !== i))} aria-label={tc("remove")}><Trash2 /></Button>
                  </div>
                </div>
              ))}
              {hero.length < 12 && (adding ? (
                <ImageUpload bucket="site" preset="hero" value={null} aspect="aspect-video" onChange={(url) => { if (url) setHero([...hero, url]); setAdding(false); }} />
              ) : (
                <button type="button" onClick={() => setAdding(true)} className="grid aspect-video place-items-center rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <span className="flex flex-col items-center gap-1"><ImagePlus className="h-6 w-6" />{t("addHeroImage")}</span>
                </button>
              ))}
            </div>
          </div>
          <BilingualField form={form} name="heroTitle" label={t("heroTitle")} />
          <BilingualField form={form} name="heroSubtitle" label={t("heroSubtitle")} multiline rows={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("sections")}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <BilingualField form={form} name="aboutText" label={t("aboutText")} multiline rows={4} />
          <BilingualField form={form} name="howItWorks" label={t("howItWorks")} multiline />
          <BilingualField form={form} name="ctaText" label={t("ctaText")} multiline rows={2} />
          <BilingualField form={form} name="footerText" label={t("footerText")} multiline rows={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("seo")}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <BilingualField form={form} name="metaTitle" label={t("metaTitle")} />
          <BilingualField form={form} name="metaDescription" label={t("metaDescription")} multiline rows={2} />
        </CardContent>
      </Card>

      {can("website.edit") && <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" className="shadow-lift" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}{tc("save")}
        </Button>
      </div>}
    </form>
  );
}
