"use client";

import { useState } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type FilterFnOption,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

const normalize = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Generic table with search, sorting and pagination (TanStack Table). */
export function DataTable<T>({
  columns, data, searchPlaceholder, toolbar, empty, initialSorting = [], pageSize = 10, globalFilterFn, onRowClick, rowClassName,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  empty?: React.ReactNode;
  initialSorting?: SortingState;
  pageSize?: number;
  /** Custom text matcher; default searches every string cell (accent-insensitive). */
  globalFilterFn?: (row: T, query: string) => boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  const t = useTranslations("common");
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");

  const filterFn: FilterFnOption<T> = (row, _columnId, value) => {
    const q = normalize(value);
    if (!q) return true;
    if (globalFilterFn) return globalFilterFn(row.original, q);
    return Object.values(row.original as Record<string, unknown>).some((v) => typeof v === "string" || typeof v === "number" ? normalize(v).includes(q) : false);
  };

  const table = useReactTable({
    data, columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: filterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={searchPlaceholder ?? t("search")} className="ps-9" aria-label={t("searchLabel")} data-search-input />
        </div>
        {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">{toolbar}</div>}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sortable = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    const meta = h.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <th key={h.id} scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                        className={cn("whitespace-nowrap px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground", meta?.className)}>
                        {h.isPlaceholder ? null : sortable ? (
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1.5 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : dir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-muted-foreground">{empty ?? t("noResults")}</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn("transition-colors hover:bg-secondary/40", onRowClick && "cursor-pointer", rowClassName?.(row.original))}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return <td key={cell.id} className={cn("px-4 py-3 align-middle", meta?.className)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
        <span>{t("resultsCount", { count: total })}</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{t("rowsPerPage")}</span>
            <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[4.5rem]" aria-label={t("rowsPerPage")}><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <span className="whitespace-nowrap">{t("pageOf", { page: table.getState().pagination.pageIndex + 1, total: pageCount })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t("previous")}>
              <ChevronLeft className="flip-rtl" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t("next")}>
              <ChevronRight className="flip-rtl" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
