import { formatMoney } from "@/lib/commerce";

/** Server-rendered printable body for a purchase or an invoice. */
export function PrintDocument({
  locale, title, number, shopName, logoUrl, shopLines, partyLabel, partyLines, dateLabel, date, head, rows, totals, footer,
}: {
  title: string; number: string; shopName: string; logoUrl: string | null; shopLines: string[];
  partyLabel: string; partyLines: string[]; dateLabel: string; date: string;
  locale: string; head: string[]; rows: string[][]; totals: { label: string; value: number; strong?: boolean }[]; footer?: string;
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          {logoUrl && <img src={logoUrl} alt="" className="h-14 w-14 object-contain" />}
          <div>
            <div className="text-xl font-bold">{shopName}</div>
            {shopLines.filter(Boolean).map((l) => <div key={l} className="text-xs">{l}</div>)}
          </div>
        </div>
        <div className="text-end">
          <div className="text-2xl font-bold uppercase">{title}</div>
          <div className="font-mono">{number}</div>
          <div className="text-xs">{dateLabel} : {date}</div>
        </div>
      </header>
      <section className="my-5">
        <div className="text-xs font-semibold uppercase text-neutral-600">{partyLabel}</div>
        {partyLines.filter(Boolean).map((l) => <div key={l}>{l}</div>)}
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">{head.map((h, i) => <th key={h} className={`border border-neutral-300 px-2 py-1.5 ${i === 0 ? "text-start" : "text-end"}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={`border border-neutral-300 px-2 py-1.5 ${j === 0 ? "text-start" : "text-end tabular-nums"}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div className="ms-auto mt-4 w-72">
        {totals.map((x) => (
          <div key={x.label} className={`flex justify-between border-b border-neutral-200 py-1 ${x.strong ? "text-base font-bold" : ""}`}>
            <span>{x.label}</span><span className="tabular-nums">{formatMoney(x.value, locale)}</span>
          </div>
        ))}
      </div>
      {footer && <footer className="mt-10 border-t pt-3 text-center text-xs text-neutral-600">{footer}</footer>}
    </>
  );
}
