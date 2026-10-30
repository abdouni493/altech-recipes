// Messages are split per namespace: messages/<locale>/<namespace>.json
export const namespaces = [
  "common", "validation", "nav", "auth", "dashboard", "units", "products", "recipes", "packs",
  "clients", "orders", "website", "settings", "portal", "calculator", "site", "workers", "suppliers", "commerce",
] as const;

export async function loadMessages(locale: string) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, (await import(`./${locale}/${ns}.json`)).default] as const)
  );
  return Object.fromEntries(entries);
}
