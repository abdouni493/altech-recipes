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
