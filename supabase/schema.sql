-- =====================================================================================
-- Recettes altech — full Supabase schema
-- Run this whole file once in Supabase → SQL Editor (it is idempotent: safe to re-run).
--
-- Contents
--   1. Extensions
--   2. Tables (every interface of the app) + relations + indexes
--   3. updated_at triggers
--   4. Helper functions (roles, worker permissions)
--   5. Account functions (admin / worker / client accounts live in auth.users)
--   6. Row Level Security policies
--   7. Storage buckets (images) + storage policies
--   8. Singleton rows (site settings, contacts, counters)
--   9. App RPC functions (called by the app with the anon key + user session)
--  10. Suppliers (tables, policies, save_supplier) — same as supabase/suppliers.sql
--  11. Commerce (stock, purchases, sales, payments, shop orders) — same as supabase/commerce.sql + commerce-2.sql
--
-- Roles
--   ADMIN  : everything. Exactly one can be created from the login page (first-run setup);
--            the "create admin" button disappears once an admin exists.
--   WORKER : staff account created by the admin. Only sees the pages / buttons whose
--            permission keys are listed in profiles.permissions (see section 4).
--   CLIENT : client portal. Only sees the recipes listed in client_permissions.
-- =====================================================================================

-- 1. Extensions ------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- 2. Tables ----------------------------------------------------------------------------

-- One row per account; id = auth.users.id (deleting the auth user deletes everything below).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique,
  role        text not null default 'CLIENT' check (role in ('ADMIN', 'WORKER', 'CLIENT')),
  name        text not null default '',
  email       text,
  language    text not null default 'fr' check (language in ('fr', 'ar')),
  permissions text[] not null default '{}',          -- WORKER permission keys
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- dimension: VOLUME | MASS | COUNT | OTHER ; factor converts to the base unit (L, kg, pc)
create table if not exists public.units (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  name_ar    text not null default '',
  symbol     text not null,
  dimension  text not null default 'OTHER' check (dimension in ('VOLUME', 'MASS', 'COUNT', 'OTHER')),
  factor     numeric(20, 8) not null default 1 check (factor > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  name_ar        text not null default '',
  description    text not null default '',
  description_ar text not null default '',
  image_url      text,
  unit_id        text not null references public.units (id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists products_unit_idx on public.products (unit_id);

create table if not exists public.recipes (
  id                    text primary key default gen_random_uuid()::text,
  name                  text not null,
  name_ar               text not null default '',
  description           text not null default '',
  description_ar        text not null default '',
  image_url             text,
  output_quantity       numeric(20, 6) not null check (output_quantity > 0),
  output_unit_id        text not null references public.units (id) on delete restrict,
  is_visible_on_website boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists recipes_output_unit_idx on public.recipes (output_unit_id);
create index if not exists recipes_visible_idx on public.recipes (is_visible_on_website);

create table if not exists public.recipe_ingredients (
  id         text primary key default gen_random_uuid()::text,
  recipe_id  text not null references public.recipes (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity   numeric(20, 6) not null check (quantity > 0),
  unit_id    text not null references public.units (id) on delete restrict,
  position   integer not null default 0,
  unique (recipe_id, product_id)
);
create index if not exists recipe_ingredients_product_idx on public.recipe_ingredients (product_id);
create index if not exists recipe_ingredients_unit_idx on public.recipe_ingredients (unit_id);

create table if not exists public.packs (
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  name_ar        text not null default '',
  description    text not null default '',
  description_ar text not null default '',
  image_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.pack_recipes (
  pack_id   text not null references public.packs (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  primary key (pack_id, recipe_id)
);
create index if not exists pack_recipes_recipe_idx on public.pack_recipes (recipe_id);

create table if not exists public.clients (
  id            text primary key default gen_random_uuid()::text,
  serial_number integer not null unique,
  full_name     text not null,
  phone         text not null,
  address       text not null default '',
  user_id       uuid not null unique references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Source of truth for what a client can see. pack_id only remembers where the recipe came from.
create table if not exists public.client_permissions (
  id         text primary key default gen_random_uuid()::text,
  client_id  text not null references public.clients (id) on delete cascade,
  recipe_id  text not null references public.recipes (id) on delete cascade,
  pack_id    text references public.packs (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, recipe_id)
);
create index if not exists client_permissions_recipe_idx on public.client_permissions (recipe_id);
create index if not exists client_permissions_pack_idx on public.client_permissions (pack_id);

create table if not exists public.orders (
  id                   text primary key default gen_random_uuid()::text,
  order_number         text not null unique,
  full_name            text not null,
  phone                text not null,
  wilaya_code          text not null,
  wilaya_name          text not null,
  commune_name         text not null,
  recipe_id            text references public.recipes (id) on delete set null,
  pack_id              text references public.packs (id) on delete set null,
  message              text not null default '',
  wants_client_account boolean not null default false,
  status               text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'CANCELLED')),
  created_at           timestamptz not null default now(),
  confirmed_at         timestamptz,
  cancelled_at         timestamptz
);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- Single row (id = 1). Translatable fields have _fr / _ar variants.
create table if not exists public.site_settings (
  id                  integer primary key default 1 check (id = 1),
  site_name_fr        text not null default 'Recettes altech',
  site_name_ar        text not null default 'وصفات ألتك',
  site_description_fr text not null default '',
  site_description_ar text not null default '',
  logo_url            text,
  favicon_url         text,
  hero_images         text not null default '[]',   -- JSON array of image URLs
  hero_title_fr       text not null default '',
  hero_title_ar       text not null default '',
  hero_subtitle_fr    text not null default '',
  hero_subtitle_ar    text not null default '',
  about_text_fr       text not null default '',
  about_text_ar       text not null default '',
  how_it_works_fr     text not null default '',
  how_it_works_ar     text not null default '',
  cta_text_fr         text not null default '',
  cta_text_ar         text not null default '',
  footer_text_fr      text not null default '',
  footer_text_ar      text not null default '',
  meta_title_fr       text not null default '',
  meta_title_ar       text not null default '',
  meta_description_fr text not null default '',
  meta_description_ar text not null default '',
  updated_at          timestamptz not null default now()
);

create table if not exists public.contact_settings (
  id                integer primary key default 1 check (id = 1),
  facebook_url      text not null default '',
  instagram_url     text not null default '',
  tiktok_url        text not null default '',
  phone             text not null default '',
  whatsapp_number   text not null default '',
  maps_location_url text not null default '',
  email             text not null default '',
  updated_at        timestamptz not null default now()
);

create table if not exists public.calculation_history (
  id              text primary key default gen_random_uuid()::text,
  client_id       text not null references public.clients (id) on delete cascade,
  recipe_id       text not null references public.recipes (id) on delete cascade,
  target_quantity numeric(20, 6) not null check (target_quantity > 0),
  unit_id         text not null references public.units (id) on delete restrict,
  created_at      timestamptz not null default now()
);
create index if not exists calculation_history_client_idx on public.calculation_history (client_id, created_at desc);

create table if not exists public.favorites (
  client_id  text not null references public.clients (id) on delete cascade,
  recipe_id  text not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, recipe_id)
);

-- Monotonic counters (client serial numbers, order numbers) — values are never reused.
create table if not exists public.counters (
  name  text primary key,
  value integer not null default 0
);

-- Key/value app metadata (e.g. lastBackupAt).
create table if not exists public.app_meta (
  key   text primary key,
  value text not null
);

-- 3. updated_at triggers ---------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'products', 'recipes', 'packs', 'site_settings', 'contact_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- 4. Helper functions ------------------------------------------------------------------
-- Worker permission keys (must match src/lib/permissions.ts):
--   dashboard.view
--   products.view  products.create  products.edit  products.delete
--   recipes.view   recipes.create   recipes.edit   recipes.delete
--   packs.view     packs.create     packs.edit     packs.delete
--   clients.view   clients.create   clients.edit   clients.permissions  clients.delete
--   orders.view    orders.edit      orders.delete
--   website.view   website.edit
--   suppliers.view suppliers.create suppliers.edit  suppliers.delete
--   purchases.view purchases.create purchases.edit purchases.delete purchases.pay
--   sales.view     sales.create     sales.edit     sales.delete     sales.pay
--   pos.use

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'WORKER'))
$$;

-- ADMIN has every permission; WORKER only the keys the admin granted.
create or replace function public.has_permission(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'ADMIN' or (role = 'WORKER' and p_key = any (permissions)))
  )
$$;

create or replace function public.current_client_id() returns text
language sql stable security definer set search_path = public as $$
  select c.id from public.clients c where c.user_id = auth.uid()
$$;

create or replace function public.client_can_see_recipe(p_recipe_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_permissions cp
    join public.clients c on c.id = cp.client_id
    where c.user_id = auth.uid() and cp.recipe_id = p_recipe_id
  )
$$;

-- Public: used by the login page to hide the "create admin account" button.
create or replace function public.admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where role = 'ADMIN')
$$;

-- 5. Account functions -----------------------------------------------------------------
-- Accounts are real Supabase Auth users (auth.users + auth.identities), so they log in with
-- supabase.auth.signInWithPassword. The role is copied into app_metadata (readable in the JWT).
-- These functions are SECURITY DEFINER and only executable by the server (postgres /
-- service_role) — never by anon or authenticated browser clients — except create_first_admin.

create or replace function public.create_app_user(
  p_email text,
  p_password text,
  p_username text,
  p_name text,
  p_role text,
  p_permissions text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if p_role not in ('ADMIN', 'WORKER', 'CLIENT') then raise exception 'invalid role'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'password too short'; end if;
  if exists (select 1 from auth.users where email = v_email) then raise exception 'email already used' using errcode = '23505'; end if;
  if exists (select 1 from public.profiles where username = lower(trim(p_username))) then raise exception 'username already used' using errcode = '23505'; end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', p_role),
    jsonb_build_object('username', lower(trim(p_username)), 'name', p_name),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, username, role, name, email, permissions)
  values (v_id, lower(trim(p_username)), p_role, coalesce(p_name, ''), v_email,
          case when p_role = 'WORKER' then coalesce(p_permissions, '{}') else '{}' end);

  return v_id;
end $$;

-- First-run setup: creates the ADMIN only while no admin exists (race-safe via advisory lock).
create or replace function public.create_first_admin(p_email text, p_password text, p_username text, p_name text)
returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  perform pg_advisory_xact_lock(hashtext('create_first_admin'));
  if exists (select 1 from public.profiles where role = 'ADMIN') then
    raise exception 'admin already exists' using errcode = '42501';
  end if;
  return public.create_app_user(p_email, p_password, p_username, p_name, 'ADMIN', '{}');
end $$;

create or replace function public.set_user_password(p_user_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if length(coalesce(p_password, '')) < 6 then raise exception 'password too short'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user_id;
end $$;

create or replace function public.verify_user_password(p_user_id uuid, p_password text) returns boolean
language sql stable security definer set search_path = public, extensions, auth as $$
  select exists (
    select 1 from auth.users
    where id = p_user_id and encrypted_password = extensions.crypt(p_password, encrypted_password)
  )
$$;

create or replace function public.set_user_email(p_user_id uuid, p_email text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_email text := lower(trim(p_email));
begin
  if exists (select 1 from auth.users where email = v_email and id <> p_user_id) then
    raise exception 'email already used' using errcode = '23505';
  end if;
  update auth.users set email = v_email, updated_at = now() where id = p_user_id;
  update auth.identities
    set identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
    where user_id = p_user_id and provider = 'email';
end $$;

-- Keeps the role in the JWT (app_metadata.role) in sync when a profile role changes.
create or replace function public.sync_role_to_auth() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
    where id = new.id;
  return new;
end $$;
drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role after insert or update of role on public.profiles
  for each row execute function public.sync_role_to_auth();

-- Deleting the auth user cascades to profiles → clients → permissions / history / favorites.
create or replace function public.delete_app_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = p_user_id;
end $$;

-- Only the server may run the account functions.
revoke all on function public.create_app_user(text, text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.create_first_admin(text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_user_password(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_user_password(uuid, text) from public, anon, authenticated;
revoke all on function public.set_user_email(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_app_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_exists() to anon, authenticated;

-- 6. Row Level Security ----------------------------------------------------------------
-- The Next.js server talks to Postgres directly (Prisma, server-side, re-checking every
-- permission). These policies protect the data from anyone using the public anon key.

alter table public.profiles            enable row level security;
alter table public.units               enable row level security;
alter table public.products            enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.packs               enable row level security;
alter table public.pack_recipes        enable row level security;
alter table public.clients             enable row level security;
alter table public.client_permissions  enable row level security;
alter table public.orders              enable row level security;
alter table public.site_settings       enable row level security;
alter table public.contact_settings    enable row level security;
alter table public.calculation_history enable row level security;
alter table public.favorites           enable row level security;
alter table public.counters            enable row level security;
alter table public.app_meta            enable row level security;

-- Drop existing policies so the file can be re-run.
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: everyone reads their own row; the admin manages all accounts.
create policy profiles_self_read   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or (role = 'CLIENT' and public.has_permission('clients.view')));
create policy profiles_admin_write on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- units: read by staff and clients (calculator); written by catalog staff.
create policy units_read  on public.units for select to authenticated using (true);
create policy units_write on public.units for all to authenticated
  using (public.has_permission('products.edit') or public.has_permission('recipes.edit'))
  with check (public.has_permission('products.create') or public.has_permission('products.edit') or public.has_permission('recipes.create') or public.has_permission('recipes.edit'));

-- products
create policy products_read   on public.products for select to authenticated using (
  public.has_permission('products.view') or public.has_permission('recipes.view')
  or exists (select 1 from public.recipe_ingredients ri where ri.product_id = products.id and public.client_can_see_recipe(ri.recipe_id)));
create policy products_insert on public.products for insert to authenticated with check (public.has_permission('products.create'));
create policy products_update on public.products for update to authenticated using (public.has_permission('products.edit')) with check (public.has_permission('products.edit'));
create policy products_delete on public.products for delete to authenticated using (public.has_permission('products.delete'));

-- recipes: public catalog sees visible recipes (name/description/image — formulas live in recipe_ingredients).
create policy recipes_public_read on public.recipes for select to anon, authenticated using (is_visible_on_website);
-- Recipe names/images are readable by every staff member (pack, client-access and website pages list them);
-- the formula itself stays in recipe_ingredients, which needs recipes.view.
create policy recipes_staff_read  on public.recipes for select to authenticated using (public.is_staff());
create policy recipes_client_read on public.recipes for select to authenticated using (public.client_can_see_recipe(id));
create policy recipes_insert on public.recipes for insert to authenticated with check (public.has_permission('recipes.create'));
create policy recipes_update on public.recipes for update to authenticated using (public.has_permission('recipes.edit')) with check (public.has_permission('recipes.edit'));
create policy recipes_delete on public.recipes for delete to authenticated using (public.has_permission('recipes.delete'));

-- recipe_ingredients: the formula — staff with recipes.view, or a client with access to the recipe.
create policy ingredients_read  on public.recipe_ingredients for select to authenticated using (public.has_permission('recipes.view') or public.client_can_see_recipe(recipe_id));
create policy ingredients_write on public.recipe_ingredients for all to authenticated
  using (public.has_permission('recipes.edit') or public.has_permission('recipes.create'))
  with check (public.has_permission('recipes.edit') or public.has_permission('recipes.create'));

-- packs: public catalog.
create policy packs_public_read on public.packs for select to anon, authenticated using (true);
create policy packs_insert on public.packs for insert to authenticated with check (public.has_permission('packs.create'));
create policy packs_update on public.packs for update to authenticated using (public.has_permission('packs.edit')) with check (public.has_permission('packs.edit'));
create policy packs_delete on public.packs for delete to authenticated using (public.has_permission('packs.delete'));

create policy pack_recipes_read  on public.pack_recipes for select to anon, authenticated using (true);
create policy pack_recipes_write on public.pack_recipes for all to authenticated
  using (public.has_permission('packs.edit') or public.has_permission('packs.create'))
  with check (public.has_permission('packs.edit') or public.has_permission('packs.create'));

-- clients: staff with clients.view; a client reads their own row.
create policy clients_read   on public.clients for select to authenticated using (public.has_permission('clients.view') or user_id = auth.uid());
create policy clients_insert on public.clients for insert to authenticated with check (public.has_permission('clients.create'));
create policy clients_update on public.clients for update to authenticated using (public.has_permission('clients.edit')) with check (public.has_permission('clients.edit'));
create policy clients_delete on public.clients for delete to authenticated using (public.has_permission('clients.delete'));

create policy client_permissions_read  on public.client_permissions for select to authenticated using (public.is_staff() or client_id = public.current_client_id());
create policy client_permissions_write on public.client_permissions for all to authenticated
  using (public.has_permission('clients.permissions') or public.has_permission('clients.create'))
  with check (public.has_permission('clients.permissions') or public.has_permission('clients.create'));

-- orders: created through the website (server action); managed by staff.
create policy orders_read   on public.orders for select to authenticated using (public.has_permission('orders.view'));
create policy orders_update on public.orders for update to authenticated using (public.has_permission('orders.edit')) with check (public.has_permission('orders.edit'));
create policy orders_delete on public.orders for delete to authenticated using (public.has_permission('orders.delete'));

-- website settings: public read, staff with website.edit write.
create policy site_settings_read  on public.site_settings for select to anon, authenticated using (true);
create policy site_settings_write on public.site_settings for all to authenticated using (public.has_permission('website.edit')) with check (public.has_permission('website.edit'));
create policy contact_settings_read  on public.contact_settings for select to anon, authenticated using (true);
create policy contact_settings_write on public.contact_settings for all to authenticated using (public.has_permission('website.edit')) with check (public.has_permission('website.edit'));

-- client-owned data
create policy history_own on public.calculation_history for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id() and public.client_can_see_recipe(recipe_id));
create policy history_staff_read on public.calculation_history for select to authenticated using (public.has_permission('clients.view'));

create policy favorites_own on public.favorites for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id() and public.client_can_see_recipe(recipe_id));
create policy favorites_staff_read on public.favorites for select to authenticated using (public.has_permission('clients.view'));

-- internal tables: admin only
create policy counters_admin on public.counters for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy app_meta_admin on public.app_meta for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 7. Storage buckets -------------------------------------------------------------------
-- Public-read buckets; uploads come from the browser (already compressed to WebP/JPEG)
-- by an authenticated staff member holding the matching permission.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('recipes',  'recipes',  true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('packs',    'packs',    true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('site',     'site',     true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_to(p_bucket text) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_bucket
    when 'products' then public.has_permission('products.create') or public.has_permission('products.edit')
    when 'recipes'  then public.has_permission('recipes.create')  or public.has_permission('recipes.edit')
    when 'packs'    then public.has_permission('packs.create')    or public.has_permission('packs.edit')
    when 'site'     then public.has_permission('website.edit')
    else false
  end
$$;

drop policy if exists "altech public read"   on storage.objects;
drop policy if exists "altech staff insert"  on storage.objects;
drop policy if exists "altech staff update"  on storage.objects;
drop policy if exists "altech staff delete"  on storage.objects;

create policy "altech public read" on storage.objects for select to anon, authenticated
  using (bucket_id in ('products', 'recipes', 'packs', 'site'));
create policy "altech staff insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('products', 'recipes', 'packs', 'site') and public.can_upload_to(bucket_id));
create policy "altech staff update" on storage.objects for update to authenticated
  using (bucket_id in ('products', 'recipes', 'packs', 'site') and public.can_upload_to(bucket_id));
create policy "altech staff delete" on storage.objects for delete to authenticated
  using (bucket_id in ('products', 'recipes', 'packs', 'site') and public.can_upload_to(bucket_id));

-- 8. Singleton rows --------------------------------------------------------------------
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
insert into public.contact_settings (id) values (1) on conflict (id) do nothing;
insert into public.counters (name, value) values ('client', 0), ('order', 0) on conflict (name) do nothing;

-- Base measurement units (needed by the unit selects; edit or delete them freely).
insert into public.units (id, name, name_ar, symbol, dimension, factor) values
  ('unit-l',  'Litre',      'لتر',      'L',  'VOLUME', 1),
  ('unit-ml', 'Millilitre', 'مليلتر',   'mL', 'VOLUME', 0.001),
  ('unit-kg', 'Kilogramme', 'كيلوغرام', 'kg', 'MASS',   1),
  ('unit-g',  'Gramme',     'غرام',     'g',  'MASS',   0.001),
  ('unit-pc', 'Pièce',      'قطعة',     'pc', 'COUNT',  1)
on conflict (id) do nothing;

-- 9. App RPC functions -----------------------------------------------------------------
-- The Next.js app only has the project URL + anon key. It calls these functions through
-- supabase.rpc() with the visitor's session; each function re-checks the caller's role and
-- worker permissions, and runs multi-step writes in one transaction.

create or replace function public.require_permission(p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission(p_key) then raise exception 'unauthorized' using errcode = '42501'; end if;
end $$;

-- "Youssef Abdouni", 7 → "youssefabdouni0007" (same formula as src/lib/utils.ts defaultCredential)
create or replace function public.default_credential(p_full_name text, p_serial integer) returns text
language sql immutable set search_path = public, extensions as $$
  select coalesce(nullif(regexp_replace(lower(extensions.unaccent(coalesce(p_full_name, ''))), '[^a-z0-9]', '', 'g'), ''), 'client')
         || lpad(p_serial::text, 4, '0')
$$;

-- Login: username → e-mail stored in Supabase Auth (an e-mail is returned as is).
create or replace function public.login_email(p_identifier text) returns text
language sql stable security definer set search_path = public, auth as $$
  select case
    when position('@' in p_identifier) > 0 then lower(trim(p_identifier))
    else (select u.email from public.profiles p join auth.users u on u.id = p.id where p.username = lower(trim(p_identifier)))
  end
$$;

create or replace function public.next_client_serial() returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_permission('clients.create');
  return greatest(coalesce((select value from public.counters where name = 'client'), 0),
                  coalesce((select max(serial_number) from public.clients), 0)) + 1;
end $$;

-- p_permissions: [{"recipeId": "...", "packId": "..." | null}, ...]
create or replace function public.staff_create_client(
  p_full_name text, p_phone text, p_address text,
  p_auto boolean, p_username text, p_password text,
  p_permissions jsonb, p_email_domain text
) returns jsonb
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_serial integer;
  v_username text;
  v_password text;
  v_user uuid;
  v_client text;
begin
  perform public.require_permission('clients.create');
  perform pg_advisory_xact_lock(hashtext('client_serial'));
  v_serial := greatest(coalesce((select value from public.counters where name = 'client'), 0),
                       coalesce((select max(serial_number) from public.clients), 0)) + 1;
  insert into public.counters (name, value) values ('client', v_serial)
    on conflict (name) do update set value = excluded.value;

  v_username := case when p_auto then public.default_credential(p_full_name, v_serial) else lower(trim(p_username)) end;
  v_password := case when p_auto then public.default_credential(p_full_name, v_serial) else p_password end;

  v_user := public.create_app_user(v_username || '@' || p_email_domain, v_password, v_username, p_full_name, 'CLIENT', '{}');
  insert into public.clients (serial_number, full_name, phone, address, user_id)
    values (v_serial, p_full_name, p_phone, coalesce(p_address, ''), v_user)
    returning id into v_client;
  insert into public.client_permissions (client_id, recipe_id, pack_id)
    select v_client, x->>'recipeId', nullif(x->>'packId', '')
    from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) x
    on conflict (client_id, recipe_id) do nothing;

  return jsonb_build_object('id', v_client, 'serial', v_serial, 'username', v_username, 'password', v_password);
end $$;

create or replace function public.staff_update_client(
  p_id text, p_full_name text, p_phone text, p_address text, p_username text, p_login_email text
) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_user uuid;
begin
  perform public.require_permission('clients.edit');
  select user_id into v_user from public.clients where id = p_id;
  if v_user is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where username = lower(trim(p_username)) and id <> v_user) then
    raise exception 'username already used' using errcode = '23505';
  end if;
  perform public.set_user_email(v_user, p_login_email);
  update public.clients set full_name = p_full_name, phone = p_phone, address = coalesce(p_address, '') where id = p_id;
  update public.profiles set name = p_full_name, username = lower(trim(p_username)), email = lower(trim(p_login_email)) where id = v_user;
end $$;

create or replace function public.staff_reset_client_password(p_id text) returns text
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_client public.clients; v_password text;
begin
  perform public.require_permission('clients.edit');
  select * into v_client from public.clients where id = p_id;
  if v_client.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  v_password := public.default_credential(v_client.full_name, v_client.serial_number);
  perform public.set_user_password(v_client.user_id, v_password);
  return v_password;
end $$;

create or replace function public.staff_delete_client(p_id text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  perform public.require_permission('clients.delete');
  select user_id into v_user from public.clients where id = p_id;
  if v_user is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.delete_app_user(v_user);
end $$;

-- Replaces a client's recipe access; favorites of recipes no longer permitted are removed.
create or replace function public.set_client_permissions(p_client_id text, p_permissions jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  perform public.require_permission('clients.permissions');
  delete from public.client_permissions where client_id = p_client_id;
  insert into public.client_permissions (client_id, recipe_id, pack_id)
    select p_client_id, x->>'recipeId', nullif(x->>'packId', '')
    from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) x
    on conflict (client_id, recipe_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.favorites f where f.client_id = p_client_id
    and not exists (select 1 from public.client_permissions cp where cp.client_id = p_client_id and cp.recipe_id = f.recipe_id);
  return v_count;
end $$;

-- Workers (admin only)
create or replace function public.admin_create_worker(
  p_name text, p_username text, p_login_email text, p_password text, p_permissions text[]
) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  v_id := public.create_app_user(p_login_email, p_password, p_username, p_name, 'WORKER', p_permissions);
  return v_id;
end $$;

create or replace function public.admin_update_worker(
  p_id uuid, p_name text, p_username text, p_email text, p_login_email text, p_password text, p_permissions text[]
) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'WORKER') then raise exception 'not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where username = lower(trim(p_username)) and id <> p_id) then
    raise exception 'username already used' using errcode = '23505';
  end if;
  perform public.set_user_email(p_id, p_login_email);
  if coalesce(p_password, '') <> '' then perform public.set_user_password(p_id, p_password); end if;
  update public.profiles set name = p_name, username = lower(trim(p_username)), email = nullif(trim(p_email), ''),
    permissions = coalesce(p_permissions, '{}') where id = p_id;
end $$;

create or replace function public.admin_delete_worker(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'WORKER') then raise exception 'not found' using errcode = 'P0002'; end if;
  perform public.delete_app_user(p_id);
end $$;

-- Own account (any signed-in user)
create or replace function public.update_own_profile(p_name text, p_username text, p_email text, p_login_email text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where username = lower(trim(p_username)) and id <> auth.uid()) then
    raise exception 'username already used' using errcode = '23505';
  end if;
  perform public.set_user_email(auth.uid(), p_login_email);
  update public.profiles set name = p_name, username = lower(trim(p_username)), email = nullif(trim(p_email), '') where id = auth.uid();
end $$;

create or replace function public.change_own_password(p_current text, p_new text) returns boolean
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if auth.uid() is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not public.verify_user_password(auth.uid(), p_current) then return false; end if;
  perform public.set_user_password(auth.uid(), p_new);
  return true;
end $$;

create or replace function public.set_my_language(p_language text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set language = p_language where id = auth.uid() and p_language in ('fr', 'ar')
$$;

-- Recipes: p_data = {name, name_ar, description, description_ar, image_url, output_quantity, output_unit_id, is_visible_on_website}
--          p_ingredients = [{product_id, quantity, unit_id}, ...] (array order = position)
create or replace function public.save_recipe(p_id text, p_data jsonb, p_ingredients jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := p_id; v_name text;
begin
  if p_id is null then perform public.require_permission('recipes.create'); else perform public.require_permission('recipes.edit'); end if;
  if v_id is null then
    insert into public.recipes (name, name_ar, description, description_ar, image_url, output_quantity, output_unit_id, is_visible_on_website)
    values (p_data->>'name', coalesce(p_data->>'name_ar', ''), coalesce(p_data->>'description', ''), coalesce(p_data->>'description_ar', ''),
            nullif(p_data->>'image_url', ''), (p_data->>'output_quantity')::numeric, p_data->>'output_unit_id',
            coalesce((p_data->>'is_visible_on_website')::boolean, true))
    returning id into v_id;
  else
    update public.recipes set
      name = p_data->>'name', name_ar = coalesce(p_data->>'name_ar', ''),
      description = coalesce(p_data->>'description', ''), description_ar = coalesce(p_data->>'description_ar', ''),
      image_url = nullif(p_data->>'image_url', ''), output_quantity = (p_data->>'output_quantity')::numeric,
      output_unit_id = p_data->>'output_unit_id', is_visible_on_website = coalesce((p_data->>'is_visible_on_website')::boolean, true)
    where id = v_id;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    delete from public.recipe_ingredients where recipe_id = v_id;
  end if;
  insert into public.recipe_ingredients (recipe_id, product_id, quantity, unit_id, position)
    select v_id, x.value->>'product_id', (x.value->>'quantity')::numeric, x.value->>'unit_id', (x.ordinality - 1)::integer
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality x;
  select name into v_name from public.recipes where id = v_id;
  return jsonb_build_object('id', v_id, 'name', v_name);
end $$;

create or replace function public.duplicate_recipe(p_id text, p_suffix text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_src public.recipes; v_id text;
begin
  perform public.require_permission('recipes.create');
  select * into v_src from public.recipes where id = p_id;
  if v_src.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  insert into public.recipes (name, name_ar, description, description_ar, image_url, output_quantity, output_unit_id, is_visible_on_website)
    values (v_src.name || ' ' || p_suffix, case when v_src.name_ar <> '' then v_src.name_ar || ' (نسخة)' else '' end,
            v_src.description, v_src.description_ar, v_src.image_url, v_src.output_quantity, v_src.output_unit_id, false)
    returning id into v_id;
  insert into public.recipe_ingredients (recipe_id, product_id, quantity, unit_id, position)
    select v_id, product_id, quantity, unit_id, position from public.recipe_ingredients where recipe_id = p_id;
  return jsonb_build_object('id', v_id, 'name', v_src.name || ' ' || p_suffix);
end $$;

-- Packs: p_data = {name, name_ar, description, description_ar, image_url}
create or replace function public.save_pack(p_id text, p_data jsonb, p_recipe_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := p_id;
begin
  if p_id is null then perform public.require_permission('packs.create'); else perform public.require_permission('packs.edit'); end if;
  if v_id is null then
    insert into public.packs (name, name_ar, description, description_ar, image_url)
      values (p_data->>'name', coalesce(p_data->>'name_ar', ''), coalesce(p_data->>'description', ''),
              coalesce(p_data->>'description_ar', ''), nullif(p_data->>'image_url', ''))
      returning id into v_id;
  else
    update public.packs set name = p_data->>'name', name_ar = coalesce(p_data->>'name_ar', ''),
      description = coalesce(p_data->>'description', ''), description_ar = coalesce(p_data->>'description_ar', ''),
      image_url = nullif(p_data->>'image_url', '')
    where id = v_id;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    delete from public.pack_recipes where pack_id = v_id;
  end if;
  insert into public.pack_recipes (pack_id, recipe_id) select v_id, r from unnest(coalesce(p_recipe_ids, '{}')) r on conflict do nothing;
  return jsonb_build_object('id', v_id, 'name', p_data->>'name');
end $$;

-- Website order form (public). The server action validates the input and rate-limits first.
create or replace function public.create_order(
  p_full_name text, p_phone text, p_wilaya_code text, p_wilaya_name text, p_commune_name text,
  p_recipe_id text, p_pack_id text, p_message text, p_wants_client_account boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_value integer; v_number text; v_recipe text; v_pack text;
begin
  select id into v_recipe from public.recipes where id = p_recipe_id and is_visible_on_website;
  select id into v_pack from public.packs where id = p_pack_id;
  insert into public.counters (name, value) values ('order', 1)
    on conflict (name) do update set value = public.counters.value + 1
    returning value into v_value;
  v_number := 'CMD-' || extract(year from now())::int || '-' || lpad(v_value::text, 4, '0');
  insert into public.orders (order_number, full_name, phone, wilaya_code, wilaya_name, commune_name, recipe_id, pack_id, message, wants_client_account)
    values (v_number, left(p_full_name, 120), left(p_phone, 30), p_wilaya_code, p_wilaya_name, p_commune_name,
            v_recipe, v_pack, left(coalesce(p_message, ''), 2000), coalesce(p_wants_client_account, false));
  return v_number;
end $$;

-- How many rows use each unit (the units dialog blocks deleting a unit in use).
create or replace function public.unit_usage()
returns table (unit_id text, products bigint, ingredients bigint, recipes bigint, history bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query
    select u.id,
      (select count(*) from public.products p where p.unit_id = u.id),
      (select count(*) from public.recipe_ingredients i where i.unit_id = u.id),
      (select count(*) from public.recipes r where r.output_unit_id = u.id),
      (select count(*) from public.calculation_history h where h.unit_id = u.id)
    from public.units u;
end $$;

-- Backup restore (admin only): replaces every data table in one transaction. Accounts are kept;
-- clients whose Supabase account no longer exists are skipped together with their rows.
create or replace function public.restore_backup(p_data jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; n integer;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from public.favorites; delete from public.calculation_history; delete from public.orders;
  delete from public.client_permissions; delete from public.clients; delete from public.pack_recipes;
  delete from public.packs; delete from public.recipe_ingredients; delete from public.recipes;
  delete from public.products; delete from public.units; delete from public.counters;
  delete from public.app_meta where key <> 'lastBackupAt';

  insert into public.units select * from jsonb_populate_recordset(null::public.units, coalesce(p_data->'units', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.products select * from jsonb_populate_recordset(null::public.products, coalesce(p_data->'products', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.recipes select * from jsonb_populate_recordset(null::public.recipes, coalesce(p_data->'recipes', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.recipe_ingredients select * from jsonb_populate_recordset(null::public.recipe_ingredients, coalesce(p_data->'recipe_ingredients', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.packs select * from jsonb_populate_recordset(null::public.packs, coalesce(p_data->'packs', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.pack_recipes select * from jsonb_populate_recordset(null::public.pack_recipes, coalesce(p_data->'pack_recipes', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.clients select c.* from jsonb_populate_recordset(null::public.clients, coalesce(p_data->'clients', '[]')) c
    where exists (select 1 from public.profiles p where p.id = c.user_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.client_permissions select x.* from jsonb_populate_recordset(null::public.client_permissions, coalesce(p_data->'client_permissions', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.orders select * from jsonb_populate_recordset(null::public.orders, coalesce(p_data->'orders', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.calculation_history select x.* from jsonb_populate_recordset(null::public.calculation_history, coalesce(p_data->'calculation_history', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.favorites select x.* from jsonb_populate_recordset(null::public.favorites, coalesce(p_data->'favorites', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.counters select * from jsonb_populate_recordset(null::public.counters, coalesce(p_data->'counters', '[]'));
  insert into public.counters (name, value) values ('client', 0), ('order', 0) on conflict (name) do nothing;
  insert into public.app_meta select * from jsonb_populate_recordset(null::public.app_meta, coalesce(p_data->'app_meta', '[]'))
    where key <> 'lastBackupAt' on conflict (key) do nothing;

  if p_data ? 'site_settings' and jsonb_array_length(p_data->'site_settings') > 0 then
    delete from public.site_settings;
    insert into public.site_settings select * from jsonb_populate_recordset(null::public.site_settings, p_data->'site_settings');
  end if;
  if p_data ? 'contact_settings' and jsonb_array_length(p_data->'contact_settings') > 0 then
    delete from public.contact_settings;
    insert into public.contact_settings select * from jsonb_populate_recordset(null::public.contact_settings, p_data->'contact_settings');
  end if;
  return v_count;
end $$;

-- Who can call what through the API
grant execute on function public.login_email(text) to anon, authenticated;
grant execute on function public.create_first_admin(text, text, text, text) to anon, authenticated;
grant execute on function public.create_order(text, text, text, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.next_client_serial() to authenticated;
grant execute on function public.staff_create_client(text, text, text, boolean, text, text, jsonb, text) to authenticated;
grant execute on function public.staff_update_client(text, text, text, text, text, text) to authenticated;
grant execute on function public.staff_reset_client_password(text) to authenticated;
grant execute on function public.staff_delete_client(text) to authenticated;
grant execute on function public.set_client_permissions(text, jsonb) to authenticated;
grant execute on function public.admin_create_worker(text, text, text, text, text[]) to authenticated;
grant execute on function public.admin_update_worker(uuid, text, text, text, text, text, text[]) to authenticated;
grant execute on function public.admin_delete_worker(uuid) to authenticated;
grant execute on function public.update_own_profile(text, text, text, text) to authenticated;
grant execute on function public.change_own_password(text, text) to authenticated;
grant execute on function public.set_my_language(text) to authenticated;
grant execute on function public.save_recipe(text, jsonb, jsonb) to authenticated;
grant execute on function public.duplicate_recipe(text, text) to authenticated;
grant execute on function public.save_pack(text, jsonb, text[]) to authenticated;
grant execute on function public.unit_usage() to authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;
revoke execute on function public.require_permission(text) from public, anon;

-- 10. Suppliers --------------------------------------------------------------------------
create table if not exists public.suppliers (
  id         text primary key default gen_random_uuid()::text,
  full_name  text not null,
  address    text not null default '',
  phone      text not null,
  phone2     text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_products (
  supplier_id text not null references public.suppliers (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  primary key (supplier_id, product_id)
);
create index if not exists supplier_products_product_idx on public.supplier_products (product_id);

drop trigger if exists suppliers_touch on public.suppliers;
create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_updated_at();

alter table public.suppliers         enable row level security;
alter table public.supplier_products enable row level security;

drop policy if exists suppliers_read   on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;
drop policy if exists supplier_products_read  on public.supplier_products;
drop policy if exists supplier_products_write on public.supplier_products;
drop policy if exists products_supplier_read  on public.products;

create policy suppliers_read   on public.suppliers for select to authenticated
  using (public.has_permission('suppliers.view') or public.current_client_id() is not null);
create policy suppliers_insert on public.suppliers for insert to authenticated with check (public.has_permission('suppliers.create'));
create policy suppliers_update on public.suppliers for update to authenticated using (public.has_permission('suppliers.edit')) with check (public.has_permission('suppliers.edit'));
create policy suppliers_delete on public.suppliers for delete to authenticated using (public.has_permission('suppliers.delete'));

create policy supplier_products_read  on public.supplier_products for select to authenticated
  using (public.has_permission('suppliers.view') or public.current_client_id() is not null);
create policy supplier_products_write on public.supplier_products for all to authenticated
  using (public.has_permission('suppliers.edit') or public.has_permission('suppliers.create'))
  with check (public.has_permission('suppliers.edit') or public.has_permission('suppliers.create'));

-- Products sold by a supplier: readable by staff who manage suppliers and by clients (supplier details).
create policy products_supplier_read on public.products for select to authenticated using (
  (public.has_permission('suppliers.view') or public.current_client_id() is not null)
  and exists (select 1 from public.supplier_products sp where sp.product_id = products.id)
  or public.has_permission('suppliers.create') or public.has_permission('suppliers.edit')
);

-- Writes the supplier and its products in one transaction.
create or replace function public.save_supplier(p_id text, p_data jsonb, p_product_ids text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := p_id;
begin
  if p_id is null then perform public.require_permission('suppliers.create'); else perform public.require_permission('suppliers.edit'); end if;
  if v_id is null then
    insert into public.suppliers (full_name, address, phone, phone2)
      values (p_data->>'full_name', coalesce(p_data->>'address', ''), p_data->>'phone', coalesce(p_data->>'phone2', ''))
      returning id into v_id;
  else
    update public.suppliers set full_name = p_data->>'full_name', address = coalesce(p_data->>'address', ''),
      phone = p_data->>'phone', phone2 = coalesce(p_data->>'phone2', '')
    where id = v_id;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    delete from public.supplier_products where supplier_id = v_id;
  end if;
  insert into public.supplier_products (supplier_id, product_id) select v_id, p from unnest(coalesce(p_product_ids, '{}')) p on conflict do nothing;
  return jsonb_build_object('id', v_id, 'name', p_data->>'full_name');
end $$;

revoke execute on function public.save_supplier(text, jsonb, text[]) from public, anon;
grant execute on function public.save_supplier(text, jsonb, text[]) to authenticated;

-- 11. Commerce ---------------------------------------------------------------------------
-- =====================================================================================
-- Commerce: stock, purchases, point of sale, sales, payments / debts, product shop orders.
-- Run once in Supabase → SQL Editor AFTER schema.sql and suppliers.sql (idempotent: safe to re-run).
--
-- Worker permission keys added:
--   purchases.view  purchases.create  purchases.edit  purchases.delete  purchases.pay
--   sales.view      sales.create      sales.edit      sales.delete      sales.pay
--   pos.use
-- Every total, discount, TVA, remaining amount and stock change is computed here, not in the browser.
-- =====================================================================================

-- 1. New columns on existing tables -----------------------------------------------------

alter table public.products add column if not exists barcode               text;
alter table public.products add column if not exists purchase_price        numeric(14, 2) not null default 0;
alter table public.products add column if not exists price_detail          numeric(14, 2) not null default 0;
alter table public.products add column if not exists price_reseller        numeric(14, 2) not null default 0;
alter table public.products add column if not exists price_wholesale       numeric(14, 2) not null default 0;
alter table public.products add column if not exists stock_quantity        numeric(20, 3) not null default 0;
alter table public.products add column if not exists min_stock_alert       numeric(20, 3) not null default 0;
alter table public.products add column if not exists is_visible_on_website boolean not null default false;
alter table public.products add column if not exists is_out_of_stock       boolean not null default false;
create unique index if not exists products_barcode_key on public.products (barcode) where barcode is not null and barcode <> '';

alter table public.recipes add column if not exists price numeric(14, 2);
alter table public.packs   add column if not exists price numeric(14, 2);

alter table public.clients add column if not exists price_type text not null default 'DETAIL';
alter table public.clients drop constraint if exists clients_price_type_check;
alter table public.clients add constraint clients_price_type_check check (price_type in ('DETAIL', 'RESELLER', 'WHOLESALE'));

alter table public.orders add column if not exists total numeric(14, 2) not null default 0;

-- 2. New tables ------------------------------------------------------------------------

create table if not exists public.purchases (
  id              text primary key default gen_random_uuid()::text,
  purchase_number text not null unique,
  supplier_id     text references public.suppliers (id) on delete set null,
  total           numeric(14, 2) not null default 0,
  paid_amount     numeric(14, 2) not null default 0,
  remaining       numeric(14, 2) generated always as (total - paid_amount) stored,
  note            text not null default '',
  purchased_at    date not null default current_date,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists purchases_supplier_idx on public.purchases (supplier_id);
create index if not exists purchases_date_idx     on public.purchases (purchased_at desc);

create table if not exists public.purchase_items (
  id              text primary key default gen_random_uuid()::text,
  purchase_id     text not null references public.purchases (id) on delete cascade,
  product_id      text not null references public.products (id) on delete restrict,
  quantity        numeric(20, 3) not null check (quantity > 0),
  unit_cost       numeric(14, 2) not null default 0 check (unit_cost >= 0),
  line_total      numeric(14, 2) not null default 0,
  price_detail    numeric(14, 2),
  price_reseller  numeric(14, 2),
  price_wholesale numeric(14, 2),
  min_stock_alert numeric(20, 3),
  position        integer not null default 0
);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_product_idx  on public.purchase_items (product_id);

create table if not exists public.sales (
  id              text primary key default gen_random_uuid()::text,
  invoice_number  text not null unique,
  client_id       text references public.clients (id) on delete set null,   -- null = client passager
  price_type      text not null default 'DETAIL' check (price_type in ('DETAIL', 'RESELLER', 'WHOLESALE')),
  subtotal        numeric(14, 2) not null default 0,
  discount_type   text not null default 'NONE' check (discount_type in ('NONE', 'AMOUNT', 'PERCENT')),
  discount_value  numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tva_enabled     boolean not null default false,
  tva_rate        numeric(5, 2) not null default 19,
  tva_amount      numeric(14, 2) not null default 0,
  total           numeric(14, 2) not null default 0,
  paid_amount     numeric(14, 2) not null default 0,
  remaining       numeric(14, 2) generated always as (total - paid_amount) stored,
  order_id        text references public.orders (id) on delete set null,
  note            text not null default '',
  sold_at         timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sales_client_idx on public.sales (client_id);
create index if not exists sales_date_idx   on public.sales (sold_at desc);

create table if not exists public.sale_items (
  id         text primary key default gen_random_uuid()::text,
  sale_id    text not null references public.sales (id) on delete cascade,
  product_id text not null references public.products (id) on delete restrict,
  quantity   numeric(20, 3) not null check (quantity > 0),
  price_type text not null default 'DETAIL' check (price_type in ('DETAIL', 'RESELLER', 'WHOLESALE')),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  unit_cost  numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  position   integer not null default 0
);
create index if not exists sale_items_sale_idx    on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

create table if not exists public.payments (
  id          text primary key default gen_random_uuid()::text,
  kind        text not null check (kind in ('PURCHASE', 'SALE')),
  purchase_id text references public.purchases (id) on delete cascade,
  sale_id     text references public.sales (id) on delete cascade,
  amount      numeric(14, 2) not null check (amount > 0),
  method      text not null default 'CASH',
  note        text not null default '',
  paid_at     timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  constraint payments_one_ref check (
    (kind = 'PURCHASE' and purchase_id is not null and sale_id is null) or
    (kind = 'SALE' and sale_id is not null and purchase_id is null))
);
create index if not exists payments_purchase_idx on public.payments (purchase_id);
create index if not exists payments_sale_idx     on public.payments (sale_id);
create index if not exists payments_date_idx     on public.payments (paid_at desc);

create table if not exists public.stock_movements (
  id          text primary key default gen_random_uuid()::text,
  product_id  text not null references public.products (id) on delete cascade,
  type        text not null check (type in ('PURCHASE', 'SALE', 'ADJUSTMENT', 'ORDER')),
  quantity    numeric(20, 3) not null,              -- signed: + in, - out
  purchase_id text references public.purchases (id) on delete cascade,
  sale_id     text references public.sales (id) on delete cascade,
  note        text not null default '',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_purchase_idx on public.stock_movements (purchase_id);
create index if not exists stock_movements_sale_idx on public.stock_movements (sale_id);

-- One website order can now hold several recipes, packs and products.
create table if not exists public.order_items (
  id         text primary key default gen_random_uuid()::text,
  order_id   text not null references public.orders (id) on delete cascade,
  item_type  text not null check (item_type in ('RECIPE', 'PACK', 'PRODUCT')),
  recipe_id  text references public.recipes (id) on delete set null,
  pack_id    text references public.packs (id) on delete set null,
  product_id text references public.products (id) on delete set null,
  name       text not null default '',               -- snapshot, survives deletion
  quantity   numeric(20, 3) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  position   integer not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- Existing orders (one recipe or one pack) → order_items.
insert into public.order_items (order_id, item_type, recipe_id, name, quantity)
  select o.id, 'RECIPE', o.recipe_id, coalesce(r.name, ''), 1
  from public.orders o left join public.recipes r on r.id = o.recipe_id
  where o.recipe_id is not null and not exists (select 1 from public.order_items i where i.order_id = o.id);
insert into public.order_items (order_id, item_type, pack_id, name, quantity)
  select o.id, 'PACK', o.pack_id, coalesce(p.name, ''), 1
  from public.orders o left join public.packs p on p.id = o.pack_id
  where o.pack_id is not null and not exists (select 1 from public.order_items i where i.order_id = o.id and i.item_type = 'PACK');

insert into public.counters (name, value) values ('purchase', 0), ('sale', 0) on conflict (name) do nothing;

-- 3. updated_at triggers ---------------------------------------------------------------

drop trigger if exists purchases_touch on public.purchases;
create trigger purchases_touch before update on public.purchases for each row execute function public.touch_updated_at();
drop trigger if exists sales_touch on public.sales;
create trigger sales_touch before update on public.sales for each row execute function public.touch_updated_at();

-- 4. Row Level Security ------------------------------------------------------------------
-- Reads only; every write goes through the security definer functions below.

alter table public.purchases       enable row level security;
alter table public.purchase_items  enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.payments        enable row level security;
alter table public.stock_movements enable row level security;
alter table public.order_items     enable row level security;

drop policy if exists purchases_read       on public.purchases;
drop policy if exists purchase_items_read  on public.purchase_items;
drop policy if exists sales_read           on public.sales;
drop policy if exists sale_items_read      on public.sale_items;
drop policy if exists payments_read        on public.payments;
drop policy if exists stock_movements_read on public.stock_movements;
drop policy if exists order_items_read     on public.order_items;
drop policy if exists products_commerce_read  on public.products;
drop policy if exists clients_commerce_read   on public.clients;
drop policy if exists suppliers_commerce_read on public.suppliers;

create policy purchases_read on public.purchases for select to authenticated
  using (public.has_permission('purchases.view') or public.has_permission('suppliers.view'));
create policy purchase_items_read on public.purchase_items for select to authenticated
  using (public.has_permission('purchases.view') or public.has_permission('products.view'));
create policy sales_read on public.sales for select to authenticated
  using (public.has_permission('sales.view') or public.has_permission('clients.view') or public.has_permission('pos.use')
         or (client_id is not null and client_id = public.current_client_id()));
create policy sale_items_read on public.sale_items for select to authenticated
  using (public.has_permission('sales.view') or public.has_permission('products.view') or public.has_permission('pos.use')
         or exists (select 1 from public.sales s where s.id = sale_id and s.client_id = public.current_client_id()));
create policy payments_read on public.payments for select to authenticated
  using ((kind = 'PURCHASE' and (public.has_permission('purchases.view') or public.has_permission('suppliers.view')))
      or (kind = 'SALE' and (public.has_permission('sales.view') or public.has_permission('clients.view'))));
create policy stock_movements_read on public.stock_movements for select to authenticated
  using (public.has_permission('products.view'));
create policy order_items_read on public.order_items for select to authenticated
  using (public.has_permission('orders.view'));

-- POS / purchase screens need products, clients and suppliers even without their own pages.
create policy products_commerce_read on public.products for select to authenticated
  using (public.has_permission('pos.use') or public.has_permission('sales.view') or public.has_permission('purchases.view'));
create policy clients_commerce_read on public.clients for select to authenticated
  using (public.has_permission('pos.use') or public.has_permission('sales.view'));
create policy suppliers_commerce_read on public.suppliers for select to authenticated
  using (public.has_permission('purchases.view'));

-- Debts per client / supplier (security_invoker: the caller's RLS applies).
create or replace view public.client_balances with (security_invoker = true) as
  select c.id as client_id, c.full_name,
    coalesce(sum(s.total), 0)       as total_sales,
    coalesce(sum(s.paid_amount), 0) as total_paid,
    coalesce(sum(s.remaining), 0)   as debt
  from public.clients c left join public.sales s on s.client_id = c.id
  group by c.id, c.full_name;

create or replace view public.supplier_balances with (security_invoker = true) as
  select sp.id as supplier_id, sp.full_name,
    coalesce(sum(p.total), 0)       as total_purchases,
    coalesce(sum(p.paid_amount), 0) as total_paid,
    coalesce(sum(p.remaining), 0)   as debt
  from public.suppliers sp left join public.purchases p on p.supplier_id = sp.id
  group by sp.id, sp.full_name;

grant select on public.client_balances, public.supplier_balances to authenticated;

-- 5. Internal helpers --------------------------------------------------------------------

-- Next document number: ACH-000001, FAC-000001 … (row-locked, never reused).
create or replace function public.next_number(p_name text, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into public.counters (name, value) values (p_name, 1)
    on conflict (name) do update set value = public.counters.value + 1
    returning value into v;
  return p_prefix || '-' || lpad(v::text, 6, '0');
end $$;

-- Move stock and log it.
create or replace function public._move_stock(p_product text, p_qty numeric, p_type text, p_purchase text, p_sale text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.products set stock_quantity = stock_quantity + p_qty,
    is_out_of_stock = case when stock_quantity + p_qty > 0 then false else is_out_of_stock end
  where id = p_product;
  if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
  insert into public.stock_movements (product_id, type, quantity, purchase_id, sale_id, note, created_by)
    values (p_product, p_type, p_qty, p_purchase, p_sale, coalesce(p_note, ''), auth.uid());
end $$;

-- Undo every stock movement of a purchase or a sale.
create or replace function public._reverse_stock(p_purchase text, p_sale text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.products p set stock_quantity = p.stock_quantity - m.qty
  from (select product_id, sum(quantity) qty from public.stock_movements
        where (p_purchase is not null and purchase_id = p_purchase) or (p_sale is not null and sale_id = p_sale)
        group by product_id) m
  where p.id = m.product_id;
  delete from public.stock_movements
  where (p_purchase is not null and purchase_id = p_purchase) or (p_sale is not null and sale_id = p_sale);
end $$;

-- paid_amount = sum of payments.
create or replace function public._sync_paid(p_purchase text, p_sale text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_purchase is not null then
    update public.purchases set paid_amount = coalesce((select sum(amount) from public.payments where purchase_id = p_purchase), 0) where id = p_purchase;
  end if;
  if p_sale is not null then
    update public.sales set paid_amount = coalesce((select sum(amount) from public.payments where sale_id = p_sale), 0) where id = p_sale;
  end if;
end $$;

revoke execute on function public.next_number(text, text) from public, anon, authenticated;
revoke execute on function public._move_stock(text, numeric, text, text, text, text) from public, anon, authenticated;
revoke execute on function public._reverse_stock(text, text) from public, anon, authenticated;
revoke execute on function public._sync_paid(text, text) from public, anon, authenticated;

-- 6. Purchases ---------------------------------------------------------------------------
-- p_data : { supplier_id, note, purchased_at, paid_amount }   (paid_amount used on create only)
-- p_items: [{ product_id, quantity, unit_cost, price_detail, price_reseller, price_wholesale, min_stock_alert }]
create or replace function public.save_purchase(p_id text, p_data jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := p_id; v_number text; v_total numeric := 0; v_paid numeric; it jsonb; v_pos int := 0;
        v_qty numeric; v_cost numeric;
begin
  if p_id is null then perform public.require_permission('purchases.create'); else perform public.require_permission('purchases.edit'); end if;

  if v_id is null then
    v_number := public.next_number('purchase', 'ACH');
    insert into public.purchases (purchase_number, supplier_id, note, purchased_at, created_by)
      values (v_number, nullif(p_data->>'supplier_id', ''), coalesce(p_data->>'note', ''),
              coalesce((p_data->>'purchased_at')::date, current_date), auth.uid())
      returning id into v_id;
  else
    update public.purchases set supplier_id = nullif(p_data->>'supplier_id', ''), note = coalesce(p_data->>'note', ''),
      purchased_at = coalesce((p_data->>'purchased_at')::date, purchased_at)
    where id = v_id returning purchase_number into v_number;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    perform public._reverse_stock(v_id, null);
    delete from public.purchase_items where purchase_id = v_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    v_qty  := round(coalesce((it->>'quantity')::numeric, 0), 3);
    v_cost := round(coalesce((it->>'unit_cost')::numeric, 0), 2);
    if v_qty <= 0 then continue; end if;
    v_pos := v_pos + 1;
    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost, line_total,
        price_detail, price_reseller, price_wholesale, min_stock_alert, position)
      values (v_id, it->>'product_id', v_qty, v_cost, round(v_qty * v_cost, 2),
        (it->>'price_detail')::numeric, (it->>'price_reseller')::numeric, (it->>'price_wholesale')::numeric,
        (it->>'min_stock_alert')::numeric, v_pos);
    v_total := v_total + round(v_qty * v_cost, 2);
    update public.products set
      purchase_price  = v_cost,
      price_detail    = coalesce((it->>'price_detail')::numeric, price_detail),
      price_reseller  = coalesce((it->>'price_reseller')::numeric, price_reseller),
      price_wholesale = coalesce((it->>'price_wholesale')::numeric, price_wholesale),
      min_stock_alert = coalesce((it->>'min_stock_alert')::numeric, min_stock_alert)
    where id = it->>'product_id';
    perform public._move_stock(it->>'product_id', v_qty, 'PURCHASE', v_id, null, v_number);
  end loop;

  update public.purchases set total = v_total where id = v_id;

  if p_id is null then
    v_paid := round(coalesce((p_data->>'paid_amount')::numeric, v_total), 2);
    if v_paid < 0 or v_paid > v_total then raise exception 'invalid paid amount' using errcode = '22023'; end if;
    if v_paid > 0 then
      insert into public.payments (kind, purchase_id, amount, note, created_by) values ('PURCHASE', v_id, v_paid, '', auth.uid());
    end if;
  end if;
  perform public._sync_paid(v_id, null);
  if (select paid_amount from public.purchases where id = v_id) > v_total then
    raise exception 'total lower than paid amount' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_id, 'number', v_number, 'total', v_total);
end $$;

create or replace function public.delete_purchase(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('purchases.delete');
  perform public._reverse_stock(p_id, null);
  delete from public.purchases where id = p_id;
end $$;

-- 7. Sales (POS + edit) ------------------------------------------------------------------
-- p_data : { client_id, price_type, discount_type, discount_value, tva_enabled, tva_rate, paid_amount, note, order_id }
-- p_items: [{ product_id, quantity, price_type, unit_price? }]  unit_price defaults to the product's price for price_type
create or replace function public.save_sale(p_id text, p_data jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := p_id; v_number text; it jsonb; v_pos int := 0; pr record;
        v_client text := nullif(p_data->>'client_id', '');
        v_ptype text := coalesce(nullif(p_data->>'price_type', ''), 'DETAIL');
        v_dtype text := coalesce(nullif(p_data->>'discount_type', ''), 'NONE');
        v_dval numeric := greatest(round(coalesce((p_data->>'discount_value')::numeric, 0), 2), 0);
        v_tva boolean := coalesce((p_data->>'tva_enabled')::boolean, false);
        v_rate numeric := coalesce((p_data->>'tva_rate')::numeric, 19);
        v_sub numeric := 0; v_disc numeric := 0; v_tva_amt numeric := 0; v_total numeric; v_paid numeric;
        v_qty numeric; v_price numeric; v_line_type text;
begin
  if p_id is null then
    if not (public.has_permission('sales.create') or public.has_permission('pos.use')) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else perform public.require_permission('sales.edit'); end if;

  if v_id is null then
    v_number := public.next_number('sale', 'FAC');
    insert into public.sales (invoice_number, client_id, price_type, note, order_id, created_by)
      values (v_number, v_client, v_ptype, coalesce(p_data->>'note', ''), nullif(p_data->>'order_id', ''), auth.uid())
      returning id into v_id;
  else
    update public.sales set client_id = v_client, price_type = v_ptype, note = coalesce(p_data->>'note', '')
    where id = v_id returning invoice_number into v_number;
    if not found then raise exception 'not found' using errcode = 'P0002'; end if;
    perform public._reverse_stock(null, v_id);
    delete from public.sale_items where sale_id = v_id;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    v_qty := round(coalesce((it->>'quantity')::numeric, 0), 3);
    if v_qty <= 0 then continue; end if;
    select * into pr from public.products where id = it->>'product_id';
    if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
    v_line_type := coalesce(nullif(it->>'price_type', ''), v_ptype);
    v_price := round(coalesce((it->>'unit_price')::numeric,
      case v_line_type when 'RESELLER' then pr.price_reseller when 'WHOLESALE' then pr.price_wholesale else pr.price_detail end), 2);
    v_pos := v_pos + 1;
    insert into public.sale_items (sale_id, product_id, quantity, price_type, unit_price, unit_cost, line_total, position)
      values (v_id, pr.id, v_qty, v_line_type, v_price, pr.purchase_price, round(v_qty * v_price, 2), v_pos);
    v_sub := v_sub + round(v_qty * v_price, 2);
    perform public._move_stock(pr.id, -v_qty, 'SALE', null, v_id, v_number);
  end loop;

  v_disc := case v_dtype when 'AMOUNT' then least(v_dval, v_sub)
                         when 'PERCENT' then round(v_sub * least(v_dval, 100) / 100, 2) else 0 end;
  v_tva_amt := case when v_tva then round((v_sub - v_disc) * v_rate / 100, 2) else 0 end;
  v_total := v_sub - v_disc + v_tva_amt;

  update public.sales set subtotal = v_sub, discount_type = v_dtype, discount_value = v_dval, discount_amount = v_disc,
    tva_enabled = v_tva, tva_rate = v_rate, tva_amount = v_tva_amt, total = v_total
  where id = v_id;

  if p_id is null then
    v_paid := round(coalesce((p_data->>'paid_amount')::numeric, v_total), 2);
    if v_paid < 0 or v_paid > v_total then raise exception 'invalid paid amount' using errcode = '22023'; end if;
    if v_paid > 0 then
      insert into public.payments (kind, sale_id, amount, created_by) values ('SALE', v_id, v_paid, auth.uid());
    end if;
  end if;
  perform public._sync_paid(null, v_id);

  if (select paid_amount from public.sales where id = v_id) > v_total then
    raise exception 'total lower than paid amount' using errcode = '22023';
  end if;
  -- Client passager: must pay everything.
  if v_client is null and (select remaining from public.sales where id = v_id) > 0 then
    raise exception 'walk-in client must pay the full amount' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_id, 'number', v_number, 'subtotal', v_sub, 'discount', v_disc, 'tva', v_tva_amt, 'total', v_total);
end $$;

create or replace function public.delete_sale(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_permission('sales.delete');
  perform public._reverse_stock(null, p_id);
  delete from public.sales where id = p_id;
end $$;

-- 8. Payments / debts --------------------------------------------------------------------

create or replace function public.add_payment(p_kind text, p_ref_id text, p_amount numeric, p_note text default '', p_method text default 'CASH')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_remaining numeric; v_amount numeric := round(coalesce(p_amount, 0), 2);
begin
  if p_kind = 'PURCHASE' then
    perform public.require_permission('purchases.pay');
    select remaining into v_remaining from public.purchases where id = p_ref_id for update;
  elsif p_kind = 'SALE' then
    perform public.require_permission('sales.pay');
    select remaining into v_remaining from public.sales where id = p_ref_id for update;
  else raise exception 'invalid kind' using errcode = '22023'; end if;
  if v_remaining is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_amount <= 0 or v_amount > v_remaining then raise exception 'invalid amount' using errcode = '22023'; end if;

  insert into public.payments (kind, purchase_id, sale_id, amount, note, method, created_by)
    values (p_kind, case when p_kind = 'PURCHASE' then p_ref_id end, case when p_kind = 'SALE' then p_ref_id end,
            v_amount, coalesce(p_note, ''), coalesce(nullif(p_method, ''), 'CASH'), auth.uid());
  if p_kind = 'PURCHASE' then perform public._sync_paid(p_ref_id, null); else perform public._sync_paid(null, p_ref_id); end if;
  return jsonb_build_object('remaining', v_remaining - v_amount);
end $$;

-- p_allocations: [{ id, amount }] — each id must be an invoice of that client.
create or replace function public.pay_client_debt(p_client_id text, p_allocations jsonb, p_note text default '') returns numeric
language plpgsql security definer set search_path = public as $$
declare a jsonb; v_sum numeric := 0;
begin
  perform public.require_permission('sales.pay');
  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]')) loop
    if coalesce((a->>'amount')::numeric, 0) <= 0 then continue; end if;
    if not exists (select 1 from public.sales where id = a->>'id' and client_id = p_client_id) then
      raise exception 'invoice does not belong to client' using errcode = '22023';
    end if;
    perform public.add_payment('SALE', a->>'id', (a->>'amount')::numeric, p_note);
    v_sum := v_sum + round((a->>'amount')::numeric, 2);
  end loop;
  return v_sum;
end $$;

create or replace function public.pay_supplier_debt(p_supplier_id text, p_allocations jsonb, p_note text default '') returns numeric
language plpgsql security definer set search_path = public as $$
declare a jsonb; v_sum numeric := 0;
begin
  perform public.require_permission('purchases.pay');
  for a in select * from jsonb_array_elements(coalesce(p_allocations, '[]')) loop
    if coalesce((a->>'amount')::numeric, 0) <= 0 then continue; end if;
    if not exists (select 1 from public.purchases where id = a->>'id' and supplier_id = p_supplier_id) then
      raise exception 'purchase does not belong to supplier' using errcode = '22023';
    end if;
    perform public.add_payment('PURCHASE', a->>'id', (a->>'amount')::numeric, p_note);
    v_sum := v_sum + round((a->>'amount')::numeric, 2);
  end loop;
  return v_sum;
end $$;

-- Manual stock correction (inventory count).
create or replace function public.adjust_stock(p_product_id text, p_new_quantity numeric, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare v_current numeric;
begin
  perform public.require_permission('products.edit');
  select stock_quantity into v_current from public.products where id = p_product_id for update;
  if v_current is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if round(p_new_quantity, 3) <> v_current then
    perform public._move_stock(p_product_id, round(p_new_quantity, 3) - v_current, 'ADJUSTMENT', null, null, p_note);
  end if;
end $$;

-- 9. History / reports (optional date range) ---------------------------------------------

create or replace function public.product_history(p_product_id text, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f timestamptz := coalesce(p_from, '1900-01-01')::timestamptz; t timestamptz := (coalesce(p_to, '2999-12-31') + 1)::timestamptz;
begin
  perform public.require_permission('products.view');
  return jsonb_build_object(
    'purchases', coalesce((select jsonb_agg(x order by x.date desc) from (
        select p.id, p.purchase_number as number, p.purchased_at::timestamptz as date, s.full_name as supplier,
               i.quantity, i.unit_cost, i.line_total
        from public.purchase_items i join public.purchases p on p.id = i.purchase_id left join public.suppliers s on s.id = p.supplier_id
        where i.product_id = p_product_id and p.purchased_at >= f::date and p.purchased_at < t::date) x), '[]'),
    'sales', coalesce((select jsonb_agg(x order by x.date desc) from (
        select s.id, s.invoice_number as number, s.sold_at as date, c.full_name as client,
               i.quantity, i.price_type, i.unit_price, i.line_total, round(i.quantity * (i.unit_price - i.unit_cost), 2) as profit
        from public.sale_items i join public.sales s on s.id = i.sale_id left join public.clients c on c.id = s.client_id
        where i.product_id = p_product_id and s.sold_at >= f and s.sold_at < t) x), '[]'),
    'recipes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'name_ar', r.name_ar, 'quantity', ri.quantity, 'unit_id', ri.unit_id))
        from public.recipe_ingredients ri join public.recipes r on r.id = ri.recipe_id where ri.product_id = p_product_id), '[]'),
    'orders', coalesce((select jsonb_agg(x order by x.date desc) from (
        select o.id, o.order_number as number, o.created_at as date, o.full_name as client, o.status, i.quantity, i.line_total
        from public.order_items i join public.orders o on o.id = i.order_id
        where i.product_id = p_product_id and o.created_at >= f and o.created_at < t) x), '[]'),
    'movements', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select id, type, quantity, note, created_at from public.stock_movements
        where product_id = p_product_id and created_at >= f and created_at < t) x), '[]'),
    'totals', jsonb_build_object(
      'purchased_qty',    (select coalesce(sum(i.quantity), 0)   from public.purchase_items i join public.purchases p on p.id = i.purchase_id where i.product_id = p_product_id and p.purchased_at >= f::date and p.purchased_at < t::date),
      'purchased_amount', (select coalesce(sum(i.line_total), 0) from public.purchase_items i join public.purchases p on p.id = i.purchase_id where i.product_id = p_product_id and p.purchased_at >= f::date and p.purchased_at < t::date),
      'sold_qty',         (select coalesce(sum(i.quantity), 0)   from public.sale_items i join public.sales s on s.id = i.sale_id where i.product_id = p_product_id and s.sold_at >= f and s.sold_at < t),
      'sold_amount',      (select coalesce(sum(i.line_total), 0) from public.sale_items i join public.sales s on s.id = i.sale_id where i.product_id = p_product_id and s.sold_at >= f and s.sold_at < t),
      'profit',           (select coalesce(sum(i.quantity * (i.unit_price - i.unit_cost)), 0) from public.sale_items i join public.sales s on s.id = i.sale_id where i.product_id = p_product_id and s.sold_at >= f and s.sold_at < t),
      'ordered_qty',      (select coalesce(sum(i.quantity), 0)   from public.order_items i join public.orders o on o.id = i.order_id where i.product_id = p_product_id and o.created_at >= f and o.created_at < t),
      'recipes_count',    (select count(*) from public.recipe_ingredients where product_id = p_product_id))
  );
end $$;

create or replace function public.client_history(p_client_id text, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f timestamptz := coalesce(p_from, '1900-01-01')::timestamptz; t timestamptz := (coalesce(p_to, '2999-12-31') + 1)::timestamptz;
begin
  if not (public.has_permission('clients.view') or public.has_permission('sales.view')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sales', coalesce((select jsonb_agg(to_jsonb(s) order by s.sold_at desc) from public.sales s
                       where s.client_id = p_client_id and s.sold_at >= f and s.sold_at < t), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'method', p.method, 'note', p.note,
                                 'paid_at', p.paid_at, 'sale_id', s.id, 'invoice_number', s.invoice_number) order by p.paid_at desc)
                          from public.payments p join public.sales s on s.id = p.sale_id
                          where s.client_id = p_client_id and p.paid_at >= f and p.paid_at < t), '[]'),
    -- Ledger: invoices (+ debit) and payments (- credit), oldest first; the UI computes the running balance.
    'ledger', coalesce((select jsonb_agg(x order by x.date) from (
        select s.sold_at as date, 'SALE' as type, s.invoice_number as reference, s.total as debit, 0::numeric as credit
          from public.sales s where s.client_id = p_client_id and s.sold_at >= f and s.sold_at < t
        union all
        select p.paid_at, 'PAYMENT', s.invoice_number, 0, p.amount
          from public.payments p join public.sales s on s.id = p.sale_id
          where s.client_id = p_client_id and p.paid_at >= f and p.paid_at < t) x), '[]'),
    'totals', (select jsonb_build_object('total', coalesce(sum(total), 0), 'paid', coalesce(sum(paid_amount), 0), 'debt', coalesce(sum(remaining), 0), 'count', count(*))
               from public.sales where client_id = p_client_id and sold_at >= f and sold_at < t)
  );
end $$;

create or replace function public.supplier_history(p_supplier_id text, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f date := coalesce(p_from, '1900-01-01'); t date := coalesce(p_to, '2999-12-31');
begin
  if not (public.has_permission('suppliers.view') or public.has_permission('purchases.view')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'purchases', coalesce((select jsonb_agg(to_jsonb(p) order by p.purchased_at desc) from public.purchases p
                           where p.supplier_id = p_supplier_id and p.purchased_at between f and t), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'amount', y.amount, 'method', y.method, 'note', y.note,
                                 'paid_at', y.paid_at, 'purchase_id', p.id, 'purchase_number', p.purchase_number) order by y.paid_at desc)
                          from public.payments y join public.purchases p on p.id = y.purchase_id
                          where p.supplier_id = p_supplier_id and y.paid_at::date between f and t), '[]'),
    'ledger', coalesce((select jsonb_agg(x order by x.date) from (
        select p.purchased_at::timestamptz as date, 'PURCHASE' as type, p.purchase_number as reference, p.total as debit, 0::numeric as credit
          from public.purchases p where p.supplier_id = p_supplier_id and p.purchased_at between f and t
        union all
        select y.paid_at, 'PAYMENT', p.purchase_number, 0, y.amount
          from public.payments y join public.purchases p on p.id = y.purchase_id
          where p.supplier_id = p_supplier_id and y.paid_at::date between f and t) x), '[]'),
    'totals', (select jsonb_build_object('total', coalesce(sum(total), 0), 'paid', coalesce(sum(paid_amount), 0), 'debt', coalesce(sum(remaining), 0), 'count', count(*))
               from public.purchases where supplier_id = p_supplier_id and purchased_at between f and t)
  );
end $$;

-- 10. Public website: products shop + multi-item orders ---------------------------------

-- Only safe columns (never purchase price or stock quantity).
create or replace function public.public_products()
returns table (id text, name text, name_ar text, description text, description_ar text, image_url text,
               barcode text, price numeric, unit_id text, is_out_of_stock boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.name_ar, p.description, p.description_ar, p.image_url, p.barcode, p.price_detail, p.unit_id,
         (p.is_out_of_stock or p.stock_quantity <= 0)
  from public.products p where p.is_visible_on_website order by p.name
$$;

-- Products used by a recipe that can be ordered on the website ("add these products too").
create or replace function public.public_recipe_products(p_recipe_id text)
returns table (id text, name text, name_ar text, image_url text, price numeric, is_out_of_stock boolean)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.name, p.name_ar, p.image_url, p.price_detail, (p.is_out_of_stock or p.stock_quantity <= 0)
  from public.recipe_ingredients ri
  join public.recipes r on r.id = ri.recipe_id and r.is_visible_on_website
  join public.products p on p.id = ri.product_id and p.is_visible_on_website
  where ri.recipe_id = p_recipe_id
$$;

-- p_items: [{ type: 'RECIPE'|'PACK'|'PRODUCT', id, quantity }] — prices re-read from the database.
create or replace function public.create_order_v2(
  p_full_name text, p_phone text, p_wilaya_code text, p_wilaya_name text, p_commune_name text,
  p_items jsonb, p_message text, p_wants_client_account boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_value integer; v_number text; v_order text; it jsonb; v_pos int := 0; v_total numeric := 0;
        v_qty numeric; v_name text; v_price numeric; v_ok boolean;
        v_first_recipe text; v_first_pack text;
begin
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid items' using errcode = '22023';
  end if;
  insert into public.counters (name, value) values ('order', 1)
    on conflict (name) do update set value = public.counters.value + 1
    returning value into v_value;
  v_number := 'CMD-' || extract(year from now())::int || '-' || lpad(v_value::text, 4, '0');
  insert into public.orders (order_number, full_name, phone, wilaya_code, wilaya_name, commune_name, message, wants_client_account)
    values (v_number, left(p_full_name, 120), left(p_phone, 30), p_wilaya_code, p_wilaya_name, p_commune_name,
            left(coalesce(p_message, ''), 2000), coalesce(p_wants_client_account, false))
    returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := least(greatest(round(coalesce((it->>'quantity')::numeric, 1), 3), 0), 10000);
    if v_qty <= 0 then continue; end if;
    v_ok := false;
    if it->>'type' = 'RECIPE' then
      select name, coalesce(price, 0), true into v_name, v_price, v_ok from public.recipes where id = it->>'id' and is_visible_on_website;
      if v_ok then v_first_recipe := coalesce(v_first_recipe, it->>'id'); end if;
    elsif it->>'type' = 'PACK' then
      select name, coalesce(price, 0), true into v_name, v_price, v_ok from public.packs where id = it->>'id';
      if v_ok then v_first_pack := coalesce(v_first_pack, it->>'id'); end if;
    elsif it->>'type' = 'PRODUCT' then
      select name, price_detail, true into v_name, v_price, v_ok from public.products
        where id = it->>'id' and is_visible_on_website and not is_out_of_stock and stock_quantity > 0;
    end if;
    if not coalesce(v_ok, false) then continue; end if;
    v_pos := v_pos + 1;
    insert into public.order_items (order_id, item_type, recipe_id, pack_id, product_id, name, quantity, unit_price, line_total, position)
      values (v_order, it->>'type',
              case when it->>'type' = 'RECIPE' then it->>'id' end,
              case when it->>'type' = 'PACK' then it->>'id' end,
              case when it->>'type' = 'PRODUCT' then it->>'id' end,
              v_name, v_qty, v_price, round(v_qty * v_price, 2), v_pos);
    v_total := v_total + round(v_qty * v_price, 2);
  end loop;

  if v_pos = 0 then raise exception 'no valid items' using errcode = '22023'; end if;
  -- Keep the old columns filled so existing screens keep working.
  update public.orders set total = v_total, recipe_id = v_first_recipe, pack_id = v_first_pack where id = v_order;
  return v_number;
end $$;

-- 11. Grants -----------------------------------------------------------------------------

revoke execute on function public.save_purchase(text, jsonb, jsonb)               from public, anon;
revoke execute on function public.delete_purchase(text)                           from public, anon;
revoke execute on function public.save_sale(text, jsonb, jsonb)                   from public, anon;
revoke execute on function public.delete_sale(text)                               from public, anon;
revoke execute on function public.add_payment(text, text, numeric, text, text)    from public, anon;
revoke execute on function public.pay_client_debt(text, jsonb, text)              from public, anon;
revoke execute on function public.pay_supplier_debt(text, jsonb, text)            from public, anon;
revoke execute on function public.adjust_stock(text, numeric, text)               from public, anon;
revoke execute on function public.product_history(text, date, date)               from public, anon;
revoke execute on function public.client_history(text, date, date)                from public, anon;
revoke execute on function public.supplier_history(text, date, date)              from public, anon;

grant execute on function public.save_purchase(text, jsonb, jsonb)               to authenticated;
grant execute on function public.delete_purchase(text)                           to authenticated;
grant execute on function public.save_sale(text, jsonb, jsonb)                   to authenticated;
grant execute on function public.delete_sale(text)                               to authenticated;
grant execute on function public.add_payment(text, text, numeric, text, text)    to authenticated;
grant execute on function public.pay_client_debt(text, jsonb, text)              to authenticated;
grant execute on function public.pay_supplier_debt(text, jsonb, text)            to authenticated;
grant execute on function public.adjust_stock(text, numeric, text)               to authenticated;
grant execute on function public.product_history(text, date, date)               to authenticated;
grant execute on function public.client_history(text, date, date)                to authenticated;
grant execute on function public.supplier_history(text, date, date)              to authenticated;

grant execute on function public.public_products()                                                          to anon, authenticated;
grant execute on function public.public_recipe_products(text)                                               to anon, authenticated;
grant execute on function public.create_order_v2(text, text, text, text, text, jsonb, text, boolean)        to anon, authenticated;

-- =====================================================================================
-- Commerce, part 2 — run once in Supabase → SQL Editor AFTER supabase/commerce.sql (idempotent: safe to re-run).
--   * set_client_price_type / set_catalog_price: small writes used by the client wizard, POS, recipe and pack forms
--   * restore_backup: now also restores suppliers and every commerce table (backup format v4, v3 still accepted)
-- =====================================================================================

-- Client selling price type (DETAIL / RESELLER / WHOLESALE). Callable right after creating a client from the POS.
create or replace function public.set_client_price_type(p_client_id text, p_price_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('clients.create') or public.has_permission('clients.edit') or public.has_permission('pos.use')) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_price_type not in ('DETAIL', 'RESELLER', 'WHOLESALE') then raise exception 'invalid price type' using errcode = '22023'; end if;
  update public.clients set price_type = p_price_type where id = p_client_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

-- Website price of a recipe or a pack (null = no price shown).
create or replace function public.set_catalog_price(p_kind text, p_id text, p_price numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_price is not null and p_price < 0 then raise exception 'invalid price' using errcode = '22023'; end if;
  if p_kind = 'RECIPE' then
    if not (public.has_permission('recipes.create') or public.has_permission('recipes.edit')) then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
    update public.recipes set price = round(p_price, 2) where id = p_id;
  elsif p_kind = 'PACK' then
    if not (public.has_permission('packs.create') or public.has_permission('packs.edit')) then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
    update public.packs set price = round(p_price, 2) where id = p_id;
  else
    raise exception 'invalid kind' using errcode = '22023';
  end if;
end $$;

revoke execute on function public.set_client_price_type(text, text) from public, anon;
revoke execute on function public.set_catalog_price(text, text, numeric) from public, anon;
grant execute on function public.set_client_price_type(text, text) to authenticated;
grant execute on function public.set_catalog_price(text, text, numeric) to authenticated;

-- Backup restore (admin only): replaces every data table in one transaction. Accounts are kept;
-- clients whose Supabase account no longer exists are skipped together with their rows.
-- Tables missing from an older archive are restored empty.
create or replace function public.restore_backup(p_data jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; n integer;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- Children first.
  delete from public.payments; delete from public.stock_movements; delete from public.sale_items; delete from public.sales;
  delete from public.purchase_items; delete from public.purchases; delete from public.order_items;
  delete from public.supplier_products; delete from public.suppliers;
  delete from public.favorites; delete from public.calculation_history; delete from public.orders;
  delete from public.client_permissions; delete from public.clients; delete from public.pack_recipes;
  delete from public.packs; delete from public.recipe_ingredients; delete from public.recipes;
  delete from public.products; delete from public.units; delete from public.counters;
  delete from public.app_meta where key <> 'lastBackupAt';

  insert into public.units select * from jsonb_populate_recordset(null::public.units, coalesce(p_data->'units', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.products select * from jsonb_populate_recordset(null::public.products, coalesce(p_data->'products', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.recipes select * from jsonb_populate_recordset(null::public.recipes, coalesce(p_data->'recipes', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.recipe_ingredients select * from jsonb_populate_recordset(null::public.recipe_ingredients, coalesce(p_data->'recipe_ingredients', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.packs select * from jsonb_populate_recordset(null::public.packs, coalesce(p_data->'packs', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.pack_recipes select * from jsonb_populate_recordset(null::public.pack_recipes, coalesce(p_data->'pack_recipes', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.clients select c.* from jsonb_populate_recordset(null::public.clients, coalesce(p_data->'clients', '[]')) c
    where exists (select 1 from public.profiles p where p.id = c.user_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.client_permissions select x.* from jsonb_populate_recordset(null::public.client_permissions, coalesce(p_data->'client_permissions', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.orders select * from jsonb_populate_recordset(null::public.orders, coalesce(p_data->'orders', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.order_items select * from jsonb_populate_recordset(null::public.order_items, coalesce(p_data->'order_items', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.calculation_history select x.* from jsonb_populate_recordset(null::public.calculation_history, coalesce(p_data->'calculation_history', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.favorites select x.* from jsonb_populate_recordset(null::public.favorites, coalesce(p_data->'favorites', '[]')) x
    where exists (select 1 from public.clients c where c.id = x.client_id);
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.suppliers select * from jsonb_populate_recordset(null::public.suppliers, coalesce(p_data->'suppliers', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.supplier_products select * from jsonb_populate_recordset(null::public.supplier_products, coalesce(p_data->'supplier_products', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;

  -- Commerce (created_by points to accounts that may not exist any more → null).
  insert into public.purchases (id, purchase_number, supplier_id, total, paid_amount, note, purchased_at, created_by, created_at, updated_at)
    select x.id, x.purchase_number, x.supplier_id, x.total, x.paid_amount, x.note, x.purchased_at,
           (select p.id from public.profiles p where p.id = x.created_by), x.created_at, x.updated_at
    from jsonb_populate_recordset(null::public.purchases, coalesce(p_data->'purchases', '[]')) x;
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.purchase_items select * from jsonb_populate_recordset(null::public.purchase_items, coalesce(p_data->'purchase_items', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.sales (id, invoice_number, client_id, price_type, subtotal, discount_type, discount_value, discount_amount,
      tva_enabled, tva_rate, tva_amount, total, paid_amount, order_id, note, sold_at, created_by, created_at, updated_at)
    select x.id, x.invoice_number, (select c.id from public.clients c where c.id = x.client_id), x.price_type, x.subtotal, x.discount_type,
           x.discount_value, x.discount_amount, x.tva_enabled, x.tva_rate, x.tva_amount, x.total, x.paid_amount, x.order_id, x.note,
           x.sold_at, (select p.id from public.profiles p where p.id = x.created_by), x.created_at, x.updated_at
    from jsonb_populate_recordset(null::public.sales, coalesce(p_data->'sales', '[]')) x;
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.sale_items select * from jsonb_populate_recordset(null::public.sale_items, coalesce(p_data->'sale_items', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.payments (id, kind, purchase_id, sale_id, amount, method, note, paid_at, created_by)
    select x.id, x.kind, x.purchase_id, x.sale_id, x.amount, x.method, x.note, x.paid_at, (select p.id from public.profiles p where p.id = x.created_by)
    from jsonb_populate_recordset(null::public.payments, coalesce(p_data->'payments', '[]')) x;
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.stock_movements (id, product_id, type, quantity, purchase_id, sale_id, note, created_by, created_at)
    select x.id, x.product_id, x.type, x.quantity, x.purchase_id, x.sale_id, x.note, (select p.id from public.profiles p where p.id = x.created_by), x.created_at
    from jsonb_populate_recordset(null::public.stock_movements, coalesce(p_data->'stock_movements', '[]')) x;
  get diagnostics n = row_count; v_count := v_count + n;

  insert into public.counters select * from jsonb_populate_recordset(null::public.counters, coalesce(p_data->'counters', '[]'));
  insert into public.counters (name, value) values ('client', 0), ('order', 0), ('purchase', 0), ('sale', 0) on conflict (name) do nothing;
  insert into public.app_meta select * from jsonb_populate_recordset(null::public.app_meta, coalesce(p_data->'app_meta', '[]'))
    where key <> 'lastBackupAt' on conflict (key) do nothing;

  if p_data ? 'site_settings' and jsonb_array_length(p_data->'site_settings') > 0 then
    delete from public.site_settings;
    insert into public.site_settings select * from jsonb_populate_recordset(null::public.site_settings, p_data->'site_settings');
  end if;
  if p_data ? 'contact_settings' and jsonb_array_length(p_data->'contact_settings') > 0 then
    delete from public.contact_settings;
    insert into public.contact_settings select * from jsonb_populate_recordset(null::public.contact_settings, p_data->'contact_settings');
  end if;
  return v_count;
end $$;

grant execute on function public.restore_backup(jsonb) to authenticated;
