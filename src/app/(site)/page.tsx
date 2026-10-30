import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight, BookOpen, Calculator, ClipboardList, Heart, History, KeyRound, LifeBuoy, ListChecks, Mail, MapPin, MousePointerClick,
  Phone, Printer, Quote, Send, Sparkles,
} from "lucide-react";
import { getContactSettings, getSiteSettings, localized, parseHeroImages } from "@/lib/site";
import { getPublicPacks, getPublicRecipes } from "@/lib/public-queries";
import { formatMoney } from "@/lib/commerce";
import { HeroSlider } from "@/components/site/hero-slider";
import { PublicRecipeCard } from "@/components/site/public-recipe-card";
import { SocialLinks, WhatsAppIcon } from "@/components/site/social-icons";
import { Marquee, Reveal, Stagger, StaggerItem, TextReveal } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { ldesc, lname } from "@/lib/i18n-data";
import { whatsappLink } from "@/lib/utils";

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getTranslations("site");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav.site");
  const [settings, contact, featured, packs] = await Promise.all([getSiteSettings(), getContactSettings(), getPublicRecipes(6), getPublicPacks()]);
  const heroImages = parseHeroImages(settings);

  const steps = [
    { icon: MousePointerClick, n: 1 }, { icon: Send, n: 2 }, { icon: KeyRound, n: 3 }, { icon: Sparkles, n: 4 },
  ];
  const benefits = [
    { icon: KeyRound, k: "account" }, { icon: BookOpen, k: "recipes" }, { icon: Calculator, k: "calculator" }, { icon: ListChecks, k: "checklist" },
    { icon: History, k: "history" }, { icon: Heart, k: "favorites" }, { icon: Printer, k: "print" }, { icon: LifeBuoy, k: "help" },
  ];

  return (
    <>
      <HeroSlider images={heroImages} title={localized(settings, "heroTitle", locale)} subtitle={localized(settings, "heroSubtitle", locale)} />

      <Marquee className="overflow-hidden border-y bg-cream py-6 text-primary" items={[tn("recipes"), t("featuredTitle"), t("packsTitle"), tn("order")]} />

      {/* How it works */}
      <section className="container py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">01 · {tn("home")}</p>
          <TextReveal as="h2" text={t("howTitle")} className="mt-3 block font-serif text-3xl font-bold sm:text-5xl" />
          <p className="mt-3 text-muted-foreground">{localized(settings, "howItWorks", locale) || t("howSubtitle")}</p>
        </Reveal>
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, n }) => (
            <StaggerItem key={n}>
              <div className="group relative h-full overflow-hidden border-t-4 border-t-primary bg-card p-6 shadow-soft transition-all duration-500 hover:-translate-y-2 hover:shadow-lift">
                <span className="absolute end-5 top-4 font-serif text-5xl font-semibold text-muted/80 transition-colors group-hover:text-accent">0{n}</span>
                <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-sage-soft text-primary"><Icon className="h-6 w-6" /></span>
                <h3 className="relative mt-5 font-serif text-xl font-semibold">{t(`how.s${n}t`)}</h3>
                <p className="relative mt-2 text-sm text-muted-foreground">{t(`how.s${n}`)}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Featured recipes */}
      {featured.length > 0 && (
        <section className="bg-cream py-20 md:py-28">
          <div className="container">
            <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">02 · {tn("recipes")}</p>
                <TextReveal as="h2" text={t("featuredTitle")} className="mt-3 block font-serif text-3xl font-bold sm:text-5xl" />
                <p className="mt-2 text-muted-foreground">{t("featuredSubtitle")}</p>
              </div>
              <Button asChild variant="outline"><Link href="/recettes">{t("seeAllRecipes")}<ArrowRight className="flip-rtl" /></Link></Button>
            </Reveal>
            <Stagger className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r) => <StaggerItem key={r.id}><PublicRecipeCard recipe={r} locale={locale} cta={t("discover")} /></StaggerItem>)}
            </Stagger>
          </div>
        </section>
      )}

      {/* Client account benefits */}
      <section className="container py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.3fr]">
          <Reveal className="space-y-5">
            <p className="eyebrow">{t("benefitsEyebrow")}</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight text-balance sm:text-4xl">{t("benefitsTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("benefitsSubtitle")}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg"><Link href="/commander">{t("ctaButton")}<ArrowRight className="flip-rtl" /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/login">{tn("clientArea")}</Link></Button>
            </div>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, k }) => (
              <StaggerItem key={k}>
                <div className="flex h-full gap-4 rounded-2xl border bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-soft">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-semibold">{t(`benefits.${k}`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(`benefits.${k}Text`)}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Packs */}
      {packs.length > 0 && (
        <section className="container pb-20 md:pb-28">
          <TextReveal as="h2" text={t("packsTitle")} className="block font-serif text-3xl font-bold sm:text-5xl" />
          <Stagger className="mt-10 grid gap-6 md:grid-cols-3">
            {packs.map((p) => (
              <StaggerItem key={p.id}>
                <Link href={`/commander?pack=${p.id}`} className="group relative block h-full overflow-hidden shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="aspect-[4/3] bg-gradient-to-br from-sage-soft to-accent" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_47%_8%/0.85)] to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <h3 className="font-serif text-2xl font-semibold">{lname(p, locale)}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-white/80">{ldesc(p, locale)}</p>
                    {p.price !== null && <p className="mt-1 text-lg font-bold">{formatMoney(Number(p.price), locale)}</p>}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-lemon">{t("heroCtaSecondary")}<ArrowRight className="h-4 w-4 flip-rtl transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" /></span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* About */}
      {localized(settings, "aboutText", locale) && (
        <section className="bg-foreground py-20 text-background md:py-28 dark:bg-card dark:text-foreground">
          <Reveal className="container max-w-4xl text-center">
            <ClipboardList className="mx-auto h-8 w-8 opacity-70" />
            <h2 className="mt-4 font-serif text-3xl font-semibold sm:text-4xl">{t("aboutTitle")}</h2>
            <p className="mt-6 text-lg leading-relaxed opacity-90 md:text-xl">{localized(settings, "aboutText", locale)}</p>
          </Reveal>
        </section>
      )}

      {/* Testimonials */}
      <section className="container py-20 md:py-28">
        <TextReveal as="h2" text={t("testimonialsTitle")} className="block text-center font-serif text-3xl font-bold sm:text-5xl" />
        <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <StaggerItem key={n}>
              <figure className="flex h-full flex-col rounded-2xl border bg-card p-7 shadow-soft">
                <Quote className="h-7 w-7 text-primary/40 flip-rtl" />
                <blockquote className="mt-4 flex-1 font-serif text-lg leading-relaxed">{t(`testimonials.t${n}`)}</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">{t(`testimonials.t${n}n`).charAt(0)}</span>
                  <span>
                    <span className="block font-semibold">{t(`testimonials.t${n}n`)}</span>
                    <span className="text-sm text-muted-foreground">{t(`testimonials.t${n}r`)}</span>
                  </span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* CTA */}
      <section className="container">
        <Reveal>
          <div className="relative overflow-hidden bg-primary px-6 py-14 text-center md:px-16 md:py-20">
            <div className="absolute -start-16 -top-16 h-64 w-64 rounded-full bg-lemon/50 blur-3xl" />
            <div className="absolute -bottom-20 -end-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative mx-auto max-w-2xl space-y-5">
              <TextReveal as="h2" text={t("ctaTitle")} className="block font-serif text-3xl font-bold text-primary-foreground sm:text-6xl" />
              <p className="text-lg text-primary-foreground/80">{localized(settings, "ctaText", locale)}</p>
              <Button asChild size="lg" variant="lemon"><Link href="/commander">{t("ctaButton")}<ArrowRight className="flip-rtl" /></Link></Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Contact */}
      <section id="contact" className="container scroll-mt-24 py-20 md:py-28">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal className="space-y-4">
            <h2 className="font-serif text-3xl font-semibold sm:text-4xl">{t("contactTitle")}</h2>
            <p className="text-muted-foreground">{t("contactSubtitle")}</p>
            <div className="pt-2"><SocialLinks facebookUrl={contact.facebookUrl} instagramUrl={contact.instagramUrl} tiktokUrl={contact.tiktokUrl} /></div>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {contact.phone && (
              <StaggerItem><a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex h-full items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sage-soft text-primary"><Phone className="h-5 w-5" /></span>
                <span><span className="block text-xs text-muted-foreground">{tc("phone")}</span><span className="font-semibold" dir="ltr">{contact.phone}</span></span>
              </a></StaggerItem>
            )}
            {contact.whatsappNumber && (
              <StaggerItem><a href={whatsappLink(contact.whatsappNumber, t("whatsappHello"))} target="_blank" rel="noopener noreferrer" className="flex h-full items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366]/15 text-[#128C7E]"><WhatsAppIcon className="h-5 w-5" /></span>
                <span><span className="block text-xs text-muted-foreground">{tc("whatsapp")}</span><span className="font-semibold" dir="ltr">{contact.whatsappNumber}</span></span>
              </a></StaggerItem>
            )}
            {contact.email && (
              <StaggerItem><a href={`mailto:${contact.email}`} className="flex h-full items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground"><Mail className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block text-xs text-muted-foreground">{tc("email")}</span><span className="block truncate font-semibold">{contact.email}</span></span>
              </a></StaggerItem>
            )}
            {contact.mapsLocationUrl && (
              <StaggerItem><a href={contact.mapsLocationUrl} target="_blank" rel="noopener noreferrer" className="flex h-full items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary"><MapPin className="h-5 w-5" /></span>
                <span><span className="block text-xs text-muted-foreground">{t("findUs")}</span><span className="font-semibold">{t("openMap")}</span></span>
              </a></StaggerItem>
            )}
          </Stagger>
        </div>
      </section>
    </>
  );
}
