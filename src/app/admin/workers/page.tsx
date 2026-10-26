import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { staffPageGuard } from "@/lib/authz";
import { db, q } from "@/lib/db";
import type { Profile } from "@/lib/db-types";
import { PageHeader } from "@/components/shared/page-header";
import { WorkersView } from "./workers-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("workers"))("title") };
}

export default async function WorkersPage() {
  await staffPageGuard("ADMIN");
  const t = await getTranslations("workers");
  const workers = await q<Profile[]>(db().from("profiles").select("*").eq("role", "WORKER").order("created_at"));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <WorkersView
        workers={workers.map((w) => ({ id: w.id, name: w.name, username: w.username, email: w.email ?? "", permissions: w.permissions }))}
      />
    </>
  );
}
