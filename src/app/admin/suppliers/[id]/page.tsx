import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { hasPermission } from "@/lib/permissions";
import { getSupplier } from "@/lib/suppliers";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierDetail } from "@/components/shared/supplier-list";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await getSupplier(params.id).catch(() => null);
  return { title: s?.fullName ?? "—" };
}

export default async function SupplierPage({ params }: { params: { id: string } }) {
  const user = await staffPageGuard("suppliers.view");
  const [t, tc, supplier] = await Promise.all([getTranslations("suppliers"), getTranslations("common"), getSupplier(params.id)]);
  if (!supplier) notFound();
  return (
    <>
      <PageHeader
        title={supplier.fullName}
        backHref="/admin/suppliers"
        backLabel={t("back")}
        actions={hasPermission(user, "suppliers.edit") && (
          <Button asChild variant="outline"><Link href={`/admin/suppliers?edit=${supplier.id}`}><Pencil />{tc("edit")}</Link></Button>
        )}
      />
      <SupplierDetail supplier={supplier} />
    </>
  );
}
