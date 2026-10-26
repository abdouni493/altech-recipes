import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getPermissionCatalog } from "@/lib/client-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionsForm } from "./permissions-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("permissionsTitle") };
}

export default async function ClientPermissionsPage({ params }: { params: { id: string } }) {
  await staffPageGuard("clients.permissions");
  const t = await getTranslations("clients");
  const client = await prisma.client.findUnique({ where: { id: params.id }, include: { permissions: true } });
  if (!client) notFound();
  const catalog = await getPermissionCatalog();
  return (
    <>
      <PageHeader title={t("permissionsTitle")} description={client.fullName} backHref={`/admin/clients/${client.id}`} backLabel={client.fullName} />
      <PermissionsForm clientId={client.id} packs={catalog.packs} recipes={catalog.recipes}
        initial={client.permissions.map((p) => ({ recipeId: p.recipeId, packId: p.packId }))} />
    </>
  );
}
