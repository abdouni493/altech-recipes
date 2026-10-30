import { notFound } from "next/navigation";
import { staffPageGuard } from "@/lib/authz";
import { BarcodeLabels } from "./barcode-labels";

export default async function PrintBarcodePage({ searchParams }: { searchParams: { code?: string; name?: string; price?: string; n?: string } }) {
  await staffPageGuard("products.view");
  const code = (searchParams.code ?? "").trim();
  if (!code || code.length > 64) notFound();
  return <BarcodeLabels code={code} name={(searchParams.name ?? "").slice(0, 120)} price={Number(searchParams.price) || 0} count={Math.min(300, Math.max(1, Number(searchParams.n) || 1))} />;
}
