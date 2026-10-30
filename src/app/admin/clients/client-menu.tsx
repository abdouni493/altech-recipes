"use client";

import { useCan } from "@/components/shared/staff-permissions";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, History, KeyRound, ListChecks, MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { deleteClientAction, resetClientPasswordAction } from "@/actions/clients";
import { defaultCredential } from "@/lib/utils";
import { PartyDebtDialog } from "@/components/commerce/debt-dialogs";
import { PartyHistoryDialog } from "@/components/commerce/party-history-dialog";
import { CredentialsCard } from "./credentials-card";

type ClientLite = { id: string; fullName: string; serialNumber: number; username: string; debt?: number };

function useClientOps(client: ClientLite, afterDelete?: string) {
  const t = useTranslations("clients");
  const router = useRouter();
  const feedback = useActionFeedback();
  const [resetResult, setResetResult] = useState<string | null>(null);
  return {
    resetResult, setResetResult,
    async reset() {
      const res = await resetClientPasswordAction(client.id);
      if (!res.ok) return feedback.error(res);
      toast.success(t("resetDone"));
      setResetResult(res.data!.password);
    },
    async remove() {
      const res = await deleteClientAction(client.id);
      if (!res.ok) return feedback.error(res);
      toast.success(t("deleted"));
      if (afterDelete) router.push(afterDelete);
      router.refresh();
    },
  };
}

function Dialogs({ client, ops, confirmReset, setConfirmReset, confirmDelete, setConfirmDelete }: {
  client: ClientLite; ops: ReturnType<typeof useClientOps>;
  confirmReset: boolean; setConfirmReset: (b: boolean) => void; confirmDelete: boolean; setConfirmDelete: (b: boolean) => void;
}) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  return (
    <>
      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} variant="default" confirmLabel={t("actions.resetPassword")}
        title={t("resetTitle")} description={t("resetText", { name: client.fullName, password: defaultCredential(client.fullName, client.serialNumber) })}
        onConfirm={ops.reset} />
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={tc("deleteConfirmTitle")}
        description={<>{tc("deleteConfirmText", { name: client.fullName })} {t("deleteWarning")}</>} onConfirm={ops.remove} />
      <Dialog open={ops.resetResult !== null} onOpenChange={(o) => !o && ops.setResetResult(null)}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{t("resetDone")}</DialogTitle>
            <DialogDescription>{t("successText")}</DialogDescription>
          </DialogHeader>
          {ops.resetResult && <CredentialsCard fullName={client.fullName} serial={client.serialNumber} username={client.username} password={ops.resetResult} />}
          <DialogFooter><Button onClick={() => ops.setResetResult(null)}>{tc("close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ClientRowMenu({ client }: { client: ClientLite }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const tm = useTranslations("commerce");
  const ops = useClientOps(client);
  const can = useCan();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState(false);
  const [paying, setPaying] = useState(false);
  return (
    <div className="flex justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" title={tm("history")} aria-label={`${tm("history")} — ${client.fullName}`} onClick={() => setHistory(true)}><History /></Button>
      {can("sales.pay") && (client.debt ?? 0) > 0 && (
        <Button variant="ghost" size="icon-sm" className="text-success" title={tm("payDebt")} aria-label={`${tm("payDebt")} — ${client.fullName}`} onClick={() => setPaying(true)}><Wallet /></Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${tc("actions")} — ${client.fullName}`}><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild><Link href={`/admin/clients/${client.id}`}><Eye />{t("actions.view")}</Link></DropdownMenuItem>
          {can("clients.edit") && <DropdownMenuItem asChild><Link href={`/admin/clients/${client.id}/edit`}><Pencil />{t("actions.edit")}</Link></DropdownMenuItem>}
          {can("clients.permissions") && <DropdownMenuItem asChild><Link href={`/admin/clients/${client.id}/permissions`}><ListChecks />{t("actions.permissions")}</Link></DropdownMenuItem>}
          {can("clients.edit") && <DropdownMenuItem onSelect={() => setConfirmReset(true)}><KeyRound />{t("actions.resetPassword")}</DropdownMenuItem>}
          <DropdownMenuSeparator />
          {can("clients.delete") && <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}><Trash2 />{t("actions.delete")}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialogs client={client} ops={ops} confirmReset={confirmReset} setConfirmReset={setConfirmReset} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
      {history && <PartyHistoryDialog open onOpenChange={setHistory} kind="client" partyId={client.id} partyName={client.fullName} />}
      {paying && <PartyDebtDialog open onOpenChange={setPaying} kind="client" partyId={client.id} partyName={client.fullName} />}
    </div>
  );
}

export function ClientDetailActions({ client }: { client: ClientLite }) {
  const t = useTranslations("clients");
  const ops = useClientOps(client, "/admin/clients");
  const can = useCan();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      {can("clients.edit") && <Button variant="outline" onClick={() => setConfirmReset(true)}><KeyRound />{t("actions.resetPassword")}</Button>}
      {can("clients.delete") && <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 />{t("actions.delete")}</Button>}
      {can("clients.permissions") && <Button asChild variant="outline"><Link href={`/admin/clients/${client.id}/permissions`}><ListChecks />{t("actions.permissions")}</Link></Button>}
      {can("clients.edit") && <Button asChild><Link href={`/admin/clients/${client.id}/edit`}><Pencil />{t("actions.edit")}</Link></Button>}
      <Dialogs client={client} ops={ops} confirmReset={confirmReset} setConfirmReset={setConfirmReset} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
    </>
  );
}
