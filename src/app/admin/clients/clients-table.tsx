"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/basic";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/page-header";
import { normalizeSearch, padSerial } from "@/lib/utils";
import { Money } from "@/components/commerce/shared";
import type { PriceType } from "@/lib/commerce";
import { ClientRowMenu } from "./client-menu";

export type ClientRow = {
  id: string; serialNumber: number; fullName: string; phone: string; address: string; username: string; permissions: number;
  debt: number; priceType: PriceType;
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const tm = useTranslations("commerce");
  const can = useCan();
  const columns = useMemo<ColumnDef<ClientRow, unknown>[]>(() => [
    { id: "serial", accessorKey: "serialNumber", header: t("serial"), meta: { className: "w-20" },
      cell: ({ row }) => <span className="font-mono text-sm font-semibold text-primary">{padSerial(row.original.serialNumber)}</span> },
    { id: "fullName", accessorKey: "fullName", header: t("fullName"),
      cell: ({ row }) => <Link href={`/admin/clients/${row.original.id}`} className="font-medium hover:text-primary hover:underline">{row.original.fullName}</Link> },
    { id: "phone", accessorKey: "phone", header: t("phone"), cell: ({ row }) => <a href={`tel:${row.original.phone}`} dir="ltr" className="whitespace-nowrap hover:text-primary">{row.original.phone}</a> },
    { id: "address", accessorKey: "address", header: t("address"), enableSorting: false, meta: { className: "hidden xl:table-cell" },
      cell: ({ row }) => <span className="line-clamp-1 max-w-xs text-muted-foreground">{row.original.address || "—"}</span> },
    { id: "username", accessorKey: "username", header: t("username"), meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => <span className="font-mono text-xs" dir="ltr">{row.original.username}</span> },
    { id: "permissions", accessorKey: "permissions", header: t("permittedRecipes"),
      cell: ({ row }) => <Badge variant={row.original.permissions ? "default" : "secondary"}>{tc("recipesCount", { count: row.original.permissions })}</Badge> },
    { id: "priceType", accessorKey: "priceType", header: tm("priceType"), meta: { className: "hidden lg:table-cell" },
      cell: ({ row }) => <Badge variant="secondary">{tm(`priceTypes.${row.original.priceType}`)}</Badge> },
    { id: "debt", accessorKey: "debt", header: tm("debt"),
      cell: ({ row }) => row.original.debt > 0 ? <Money value={row.original.debt} className="font-semibold text-destructive" /> : <span className="text-muted-foreground">—</span> },
    { id: "actions", header: () => <span className="sr-only">{tc("actions")}</span>, enableSorting: false, meta: { className: "w-28 text-end" },
      cell: ({ row }) => <ClientRowMenu client={row.original} /> },
  ], [t, tc, tm]);

  if (rows.length === 0) {
    return <EmptyState icon={<Users />} title={t("emptyTitle")} description={t("emptyText")}
      action={can("clients.create") ? <Button asChild><Link href="/admin/clients/new"><UserPlus />{t("new")}</Link></Button> : undefined} />;
  }
  return (
    <DataTable columns={columns} data={rows} initialSorting={[{ id: "serial", desc: true }]}
      globalFilterFn={(c, q) => [c.fullName, c.phone, c.address, c.username, padSerial(c.serialNumber)].some((v) => normalizeSearch(v).includes(q))} />
  );
}
