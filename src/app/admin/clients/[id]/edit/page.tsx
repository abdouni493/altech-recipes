import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Client, Profile } from "@/lib/db-types";
import { PageHeader } from "@/components/shared/page-header";
import { ClientEditForm } from "./client-edit-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("editTitle") };
}

export default async function EditClientPage({ params }: { params: { id: string } }) {
  await staffPageGuard("clients.edit");
  const t = await getTranslations("clients");
  const client = await q<(Client & { user: Profile | null }) | null>(db().from("clients").select("*, user:profiles(*)").eq("id", params.id).maybeSingle());
  if (!client) notFound();
  return (
    <>
      <PageHeader title={t("editTitle")} description={client.fullName} backHref={`/admin/clients/${client.id}`} backLabel={client.fullName} />
      <ClientEditForm id={client.id} userId={client.userId} initial={{ fullName: client.fullName, phone: client.phone, address: client.address, priceType: client.priceType ?? "DETAIL", username: client.user?.username ?? "" }} />
    </>
  );
}
