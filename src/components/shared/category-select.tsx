"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/basic";
import { Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { createCategoryAction } from "@/actions/categories";
import type { CategoryDTO } from "@/lib/categories";
import { lname } from "@/lib/i18n-data";

const NONE = "__none__";

/** Category picker with an inline "new category" form; created categories are added to the list. */
export function CategorySelect({ kind, categories, value, onChange, id }: {
  kind: CategoryDTO["kind"]; categories: CategoryDTO[]; value: string | null | undefined; onChange: (id: string | null) => void; id?: string;
}) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const feedback = useActionFeedback();
  const [list, setList] = useState(categories);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await createCategoryAction({ kind, name, nameAr });
    setBusy(false);
    if (!res.ok) return feedback.error(res);
    const c = res.data!;
    setList((l) => (l.some((x) => x.id === c.id) ? l : [...l, c]));
    onChange(c.id);
    toast.success(t("categoryCreated", { name: c.name }));
    setName(""); setNameAr(""); setOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger id={id} className="flex-1"><SelectValue placeholder={t("selectCategory")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("noCategory")}</SelectItem>
          {list.map((c) => <SelectItem key={c.id} value={c.id}>{lname(c, locale)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" title={t("newCategory")} aria-label={t("newCategory")}><FolderPlus /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3 p-3">
          <p className="text-sm font-semibold">{t("newCategory")}</p>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("categoryName")} maxLength={60}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
          <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={t("categoryNameAr")} dir="rtl" lang="ar" maxLength={60}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} />
          <Button type="button" className="w-full" onClick={create} disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />}{t("create")}</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
