import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Mail, MessageCircle, Phone } from "lucide-react";
import { clientPageGuard } from "@/lib/authz";
import { getContactSettings } from "@/lib/site";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("portal"))("helpTitle") };
}

export default async function HelpPage() {
  await clientPageGuard();
  const t = await getTranslations("portal");
  const tc = await getTranslations("common");
  const contact = await getContactSettings();
  const steps = [1, 2, 3, 4] as const;
  const faqs = [1, 2, 3, 4] as const;
  const safety = [1, 2, 3, 4, 5, 6] as const;

  return (
    <>
      <PageHeader title={t("helpTitle")} description={t("helpSubtitle")} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("guideTitle")}</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-5">
                {steps.map((n) => (
                  <li key={n} className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-serif font-semibold text-primary-foreground">{n}</span>
                    <div>
                      <p className="font-medium">{t(`guide.s${n}t`)}</p>
                      <p className="text-sm text-muted-foreground">{t(`guide.s${n}`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("faqTitle")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {faqs.map((n) => (
                <details key={n} className="group rounded-xl border bg-background/50 px-4 py-3 open:bg-sage-soft/40">
                  <summary className="cursor-pointer list-none font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex items-center justify-between gap-3">{t(`faq.q${n}`)}<span className="text-primary transition-transform group-open:rotate-45">+</span></span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`faq.a${n}`)}</p>
                </details>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="border-warning/40">
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />{t("safetyTitle")}</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {safety.map((n) => (
                  <li key={n} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{t(`safety.t${n}`)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="bg-sage-soft/50">
            <CardHeader>
              <CardTitle>{t("contactTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("contactText")}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {contact.phone && <Button asChild variant="outline" className="justify-start"><a href={`tel:${contact.phone.replace(/\s/g, "")}`}><Phone />{tc("call")} · <span dir="ltr">{contact.phone}</span></a></Button>}
              {contact.whatsappNumber && <Button asChild className="justify-start"><a href={whatsappLink(contact.whatsappNumber)} target="_blank" rel="noopener noreferrer"><MessageCircle />{tc("whatsapp")}</a></Button>}
              {contact.email && <Button asChild variant="outline" className="justify-start"><a href={`mailto:${contact.email}`}><Mail />{contact.email}</a></Button>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
