import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { staffPageGuard } from "@/lib/authz";
import { staffHome } from "@/lib/permissions";
import { EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default async function ForbiddenPage() {
  const user = await staffPageGuard();
  const t = await getTranslations("workers");
  return (
    <EmptyState icon={<ShieldAlert />} title={t("forbiddenTitle")} description={t("forbiddenText")}
      action={<Button asChild><Link href={staffHome(user)}>{t("forbiddenBack")}</Link></Button>} />
  );
}
