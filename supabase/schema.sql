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
create policy profiles_self_read   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- units: read by staff and clients (calculator); written by catalog staff.
create policy units_read  on public.units for select to authenticated using (true);
create policy units_write on public.units for all to authenticated
  using (public.has_permission('products.edit') or public.has_permission('recipes.edit'))
  with check (public.has_permission('products.create') or public.has_permission('products.edit') or public.has_permission('recipes.create') or public.has_permission('recipes.edit'));

-- products
create policy products_read   on public.products for select to authenticated using (public.has_permission('products.view') or public.has_permission('recipes.view'));
create policy products_insert on public.products for insert to authenticated with check (public.has_permission('products.create'));
create policy products_update on public.products for update to authenticated using (public.has_permission('products.edit')) with check (public.has_permission('products.edit'));
create policy products_delete on public.products for delete to authenticated using (public.has_permission('products.delete'));

-- recipes: public catalog sees visible recipes (name/description/image — formulas live in recipe_ingredients).
create policy recipes_public_read on public.recipes for select to anon, authenticated using (is_visible_on_website);
create policy recipes_staff_read  on public.recipes for select to authenticated using (public.has_permission('recipes.view'));
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

create policy client_permissions_read  on public.client_permissions for select to authenticated using (public.has_permission('clients.view') or client_id = public.current_client_id());
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
