import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UserPlus } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ClientsTable, type ClientRow } from "./clients-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("clients"))("title") };
}

export default async function ClientsPage() {
  const user = await staffPageGuard("clients.view");
  const t = await getTranslations("clients");
  const clients = await prisma.client.findMany({
    orderBy: { serialNumber: "desc" },
    include: { user: { select: { username: true } }, _count: { select: { permissions: true } } },
  });
  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id, serialNumber: c.serialNumber, fullName: c.fullName, phone: c.phone, address: c.address,
    username: c.user.username, permissions: c._count.permissions,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")}
        actions={hasPermission(user, "clients.create") && <Button asChild><Link href="/admin/clients/new"><UserPlus />{t("new")}</Link></Button>} />
      <ClientsTable rows={rows} />
    </>
  );
}
