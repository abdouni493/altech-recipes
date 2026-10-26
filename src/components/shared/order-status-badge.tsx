import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/basic";

export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations("orders.status");
  if (status === "CONFIRMED") return <Badge variant="success"><CheckCircle2 className="h-3 w-3" />{t("CONFIRMED")}</Badge>;
  if (status === "CANCELLED") return <Badge variant="destructive"><XCircle className="h-3 w-3" />{t("CANCELLED")}</Badge>;
  return <Badge variant="warning"><Clock className="h-3 w-3" />{t("PENDING")}</Badge>;
}
