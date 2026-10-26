# Recettes altech

A cleaning-product recipe sales platform with three faces, all in one Next.js app, backed by **Supabase** (Postgres, Auth, Storage):

- **Staff area** (`/admin`): products and units, recipes, packs, clients, website orders, public-site content, workers (staff accounts with permissions), account settings and backup.
- **Client portal** (`/client`): only the recipes the client is allowed to see, with the production calculator, favorites and history.
- **Public website** (`/`): landing page, recipe catalog (never the formula) and an order form for the 69 Algerian wilayas.

UI in French (default) and Arabic (RTL), light and dark theme.

## Setup

1. **Database.** In Supabase → SQL Editor, run the whole file [`supabase/schema.sql`](supabase/schema.sql). It creates every table and relation, the row-level security policies, the account functions (accounts live in `auth.users`), and the public image buckets `products`, `recipes`, `packs` and `site`. It is safe to re-run.
2. **Environment.** Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `DATABASE_URL` (transaction pooler, port 6543, keep `?pgbouncer=true`) from Project Settings → Database → Connect, with your database password. On Vercel, set the same variables in Project → Settings → Environment Variables, then open `/api/health` to check the connection and the schema.
3. **Run.**
   ```bash
   npm install
   npm run dev
   ```
4. **First admin.** Open `/login` and click **Créer le compte administrateur**. The button disappears for good once the admin exists (the database refuses a second one).

## Roles

| Role | Created by | Sees |
| --- | --- | --- |
| `ADMIN` | the login page, once | everything, including Workers and backups |
| `WORKER` | the admin (`/admin/workers`) | only the pages and buttons whose permissions the admin ticked |
| `CLIENT` | staff with `clients.create` | the client portal, limited to their permitted recipes |

Every account is a real Supabase Auth user. People sign in with their username or e-mail. Clients and workers without an e-mail get the login e-mail `<username>@NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN`. Permissions are checked on every page and server action, and again by the RLS policies.

## Images

Uploads are compressed in the browser with `browser-image-compression` (WebP when supported, otherwise JPEG; see `src/utils/media.ts` for the presets), then stored in Supabase Storage with unique names and a one-year cache (`src/lib/imageUpload.ts`). Only public URLs are saved in the database.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run i18n:check` | Verify that `fr` and `ar` define the same keys |

`prisma/schema.prisma` only mirrors `supabase/schema.sql` for the Prisma client. Never run `prisma db push` or migrations against it.
