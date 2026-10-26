"use client";

import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";

type Ctx = { role: string; permissions: string[] };

const StaffContext = createContext<Ctx>({ role: "WORKER", permissions: [] });

/** Gives client components of the staff area the current user's role and worker permissions. */
export function StaffPermissionsProvider({ role, permissions, children }: Ctx & { children: React.ReactNode }) {
  return <StaffContext.Provider value={{ role, permissions }}>{children}</StaffContext.Provider>;
}

/** `can("products.delete")` — hides buttons a worker is not allowed to use (the server re-checks every action). */
export function useCan() {
  const { role, permissions } = useContext(StaffContext);
  return (perm: Permission) => role === "ADMIN" || permissions.includes(perm);
}

export function useIsAdmin() {
  return useContext(StaffContext).role === "ADMIN";
}
