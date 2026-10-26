import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { clientPageGuard } from "@/lib/authz";
import { getSupplier } from "@/lib/suppliers";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierDetail } from "@/components/shared/supplier-list";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await getSupplier(params.id).catch(() => null);
  return { title: s?.fullName ?? "—" };
}

export default async function ClientSupplierPage({ params }: { params: { id: string } }) {
  await clientPageGuard();
  const [t, supplier] = await Promise.all([getTranslations("suppliers"), getSupplier(params.id)]);
  if (!supplier) notFound();
  return (
    <>
      <PageHeader title={supplier.fullName} backHref="/client/suppliers" backLabel={t("back")} />
      <SupplierDetail supplier={supplier} />
    </>
  );
}
