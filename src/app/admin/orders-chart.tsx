"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "next-intl";

export function OrdersChart({ data, label }: { data: { month: string; count: number }[]; label: string }) {
  const rtl = useLocale() === "ar";
  return (
    <div className="h-64 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rtl ? [...data].reverse() : data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} orientation={rtl ? "right" : "left"} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "hsl(var(--secondary))" }}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }}
            formatter={(v) => [v as number, label]}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
