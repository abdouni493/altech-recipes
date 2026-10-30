"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/basic";
import { PrintSheet } from "@/components/commerce/print-sheet";
import { useMoney } from "@/components/commerce/shared";

function Code({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ean = /^\d{13}$/.test(code);
    try {
      JsBarcode(ref.current, code, { format: ean ? "EAN13" : "CODE128", height: 48, fontSize: 13, margin: 0, width: 1.6 });
    } catch {
      JsBarcode(ref.current, code, { format: "CODE128", height: 48, fontSize: 13, margin: 0 });
    }
  }, [code]);
  return <svg ref={ref} className="mx-auto max-w-full" />;
}

/** Sheet of barcode labels (name + price + code), 3 per row. */
export function BarcodeLabels({ code, name, price, count }: { code: string; name: string; price: number; count: number }) {
  const t = useTranslations("commerce");
  const money = useMoney();
  const [n, setN] = useState(count);
  return (
    <PrintSheet>
      <label className="mb-4 flex items-center gap-2 text-sm print:hidden">
        {t("labelsCount")}
        <Input type="number" min={1} max={300} value={n} onChange={(e) => setN(Math.min(300, Math.max(1, Number(e.target.value) || 1)))} className="h-9 w-24" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="break-inside-avoid rounded border border-dashed border-neutral-400 p-2 text-center">
            <div className="truncate text-xs font-semibold">{name}</div>
            {price > 0 && <div className="text-xs">{money(price)}</div>}
            <Code code={code} />
          </div>
        ))}
      </div>
    </PrintSheet>
  );
}
