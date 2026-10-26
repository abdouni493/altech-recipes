import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Calculator, Heart, Languages, MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/basic";
import { Thumb } from "@/components/shared/thumb";
import { formatDate } from "@/lib/format";
import { lname } from "@/lib/i18n-data";
import { padSerial, whatsappLink } from "@/lib/utils";
import { ClientDetailActions } from "../client-menu";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await prisma.client.findUnique({ where: { id: params.id }, select: { fullName: true } });
  return { title: c?.fullName ?? "—" };
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  await staffPageGuard("clients.view");
  const t = await getTranslations("clients");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      permissions: { include: { recipe: true, pack: true }, orderBy: { recipe: { name: "asc" } } },
      _count: { select: { history: true, favorites: true } },
    },
  });
  if (!client) notFound();

  const groups = new Map<string, { label: string; items: typeof client.permissions }>();
  for (const p of client.permissions) {
    const key = p.packId ?? "_individual";
    const label = p.pack ? lname(p.pack, locale) : t("individual");
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(p);
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{client.fullName}<Badge variant="lemon" className="font-mono text-sm">#{padSerial(client.serialNumber)}</Badge></span>}
        description={t("since", { date: formatDate(client.createdAt, locale) })}
        backHref="/admin/clients" backLabel={t("title")}
        actions={<ClientDetailActions client={{ id: client.id, fullName: client.fullName, serialNumber: client.serialNumber, username: client.user.username }} />}
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{t("detailInfo")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a href={`tel:${client.phone}`} className="flex items-center gap-3 hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" /><span dir="ltr">{client.phone}</span></a>
              <a href={whatsappLink(client.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-primary"><MessageCircle className="h-4 w-4 text-muted-foreground" />{tc("whatsapp")}</a>
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />{client.address || "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("detailAccount")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="font-mono" dir="ltr">{client.user.username}</span></div>
              <div className="flex items-center gap-3"><Languages className="h-4 w-4 text-muted-foreground" />{t("lastLogin")} : {client.user.language === "ar" ? tc("arabic") : tc("french")}</div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl bg-secondary p-3"><Calculator className="mb-1 h-4 w-4 text-primary" /><div className="font-serif text-xl font-semibold">{client._count.history}</div><div className="text-xs text-muted-foreground">{t("calculations")}</div></div>
                <div className="rounded-xl bg-secondary p-3"><Heart className="mb-1 h-4 w-4 text-primary" /><div className="font-serif text-xl font-semibold">{client._count.favorites}</div><div className="text-xs text-muted-foreground">{t("favorites")}</div></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t("detailAccess")} ({client.permissions.length})</CardTitle>
            <Link href={`/admin/clients/${client.id}/permissions`} className="text-sm font-medium text-primary hover:underline">{t("actions.permissions")}</Link>
          </CardHeader>
          <CardContent className="space-y-5">
            {client.permissions.length === 0 && <p className="text-sm text-muted-foreground">{t("noPermissions")}</p>}
            {Array.from(groups.entries()).map(([key, g]) => (
              <div key={key}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.items.map((p) => (
                    <Link key={p.id} href={`/admin/recipes/${p.recipeId}`} className="flex items-center gap-3 rounded-xl border p-2 transition-colors hover:border-primary">
                      <Thumb src={p.recipe.imageUrl} className="h-9 w-9" />
                      <span className="truncate text-sm font-medium">{lname(p.recipe, locale)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
