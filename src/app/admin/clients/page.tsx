import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UserPlus } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { db, n, q } from "@/lib/db";
import type { Client } from "@/lib/db-types";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { debtsBy } from "@/lib/commerce-queries";
import { ClientsTable, type ClientRow } from "./clients-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("title") };
}

export default async function ClientsPage() {
  const user = await staffPageGuard("clients.view");
  const t = await getTranslations("clients");
  const [clients, debts] = await Promise.all([q<(Client & { user: { username: string } | null; permissions: unknown })[]>(
    db().from("clients").select("*, user:profiles(username), permissions:client_permissions(count)").order("serial_number", { ascending: false }),
  ), debtsBy("client").catch(() => ({} as Record<string, number>))]);
  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id, serialNumber: c.serialNumber, fullName: c.fullName, phone: c.phone, address: c.address,
    username: c.user?.username ?? "", permissions: n(c.permissions), debt: debts[c.id] ?? 0, priceType: c.priceType ?? "DETAIL",
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")}
        actions={hasPermission(user, "clients.create") && <Button asChild><Link href="/admin/clients/new"><UserPlus />{t("new")}</Link></Button>} />
      <ClientsTable rows={rows} />
    </>
  );
}
