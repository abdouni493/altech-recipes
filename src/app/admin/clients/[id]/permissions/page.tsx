import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Client, ClientPermission } from "@/lib/db-types";
import { getPermissionCatalog } from "@/lib/client-queries";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionsForm } from "./permissions-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("permissionsTitle") };
}

export default async function ClientPermissionsPage({ params }: { params: { id: string } }) {
  await staffPageGuard("clients.permissions");
  const t = await getTranslations("clients");
  const client = await q<(Client & { permissions: ClientPermission[] }) | null>(
    db().from("clients").select("*, permissions:client_permissions(*)").eq("id", params.id).maybeSingle(),
  );
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
