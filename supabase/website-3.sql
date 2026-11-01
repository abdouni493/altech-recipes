-- =====================================================================================
-- Website, part 3 — run once in Supabase → SQL Editor AFTER supabase/commerce-2.sql (idempotent: safe to re-run).
--   * categories for products and recipes (website filters)
--   * product_price_tiers: quantity offers (e.g. 5 kg for 4 000 DA)
--   * pack_products: packs can hold products too (save_pack_v2, public_pack_items)
--   * personalized recipes ordered from the website (orders.is_custom, create_custom_order)
--   * create_order_v2 understands quantity offers (tier_id); public_products returns category and offers
--   * Arabic is the default language of new accounts
--   * restore_backup: also restores the new tables
-- =====================================================================================

-- 1. Categories ------------------------------------------------------------------------
create table if not exists public.categories (
  id         text primary key default gen_random_uuid()::text,
  kind       text not null check (kind in ('PRODUCT', 'RECIPE')),
  name       text not null,
  name_ar    text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (kind, name)
);
alter table public.products add column if not exists category_id text references public.categories (id) on delete set null;
alter table public.recipes  add column if not exists category_id text references public.categories (id) on delete set null;
create index if not exists products_category_idx on public.products (category_id);
create index if not exists recipes_category_idx  on public.recipes (category_id);

alter table public.categories enable row level security;
drop policy if exists categories_read  on public.categories;
drop policy if exists categories_write on public.categories;
create policy categories_read  on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.has_permission('products.create') or public.has_permission('products.edit')
      or public.has_permission('recipes.create') or public.has_permission('recipes.edit'))
  with check (public.has_permission('products.create') or public.has_permission('products.edit')
      or public.has_permission('recipes.create') or public.has_permission('recipes.edit'));

-- 2. Quantity offers: `price` is the total price of `quantity` units of the product -------
create table if not exists public.product_price_tiers (
  id         text primary key default gen_random_uuid()::text,
  product_id text not null references public.products (id) on delete cascade,
  quantity   numeric(20, 3) not null check (quantity > 0),
  price      numeric(14, 2) not null check (price >= 0),
  position   integer not null default 0,
  unique (product_id, quantity)
);
create index if not exists product_price_tiers_product_idx on public.product_price_tiers (product_id);

alter table public.product_price_tiers enable row level security;
drop policy if exists product_price_tiers_read  on public.product_price_tiers;
drop policy if exists product_price_tiers_write on public.product_price_tiers;
create policy product_price_tiers_read on public.product_price_tiers for select to anon, authenticated using (
  public.is_staff() or exists (select 1 from public.products p where p.id = product_id and p.is_visible_on_website)
);
create policy product_price_tiers_write on public.product_price_tiers for all to authenticated
  using (public.has_permission('products.create') or public.has_permission('products.edit'))
  with check (public.has_permission('products.create') or public.has_permission('products.edit'));

-- p_tiers: [{ quantity, price }] — replaces every offer of the product.
create or replace function public.save_product_tiers(p_product_id text, p_tiers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb; v_pos int := 0;
begin
  if not (public.has_permission('products.create') or public.has_permission('products.edit')) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  delete from public.product_price_tiers where product_id = p_product_id;
  for it in select * from jsonb_array_elements(coalesce(p_tiers, '[]')) loop
    if coalesce((it->>'quantity')::numeric, 0) <= 0 or coalesce((it->>'price')::numeric, -1) < 0 then continue; end if;
    v_pos := v_pos + 1;
    insert into public.product_price_tiers (product_id, quantity, price, position)
      values (p_product_id, round((it->>'quantity')::numeric, 3), round((it->>'price')::numeric, 2), v_pos)
      on conflict (product_id, quantity) do update set price = excluded.price, position = excluded.position;
  end loop;
end $$;

-- 3. Packs with products -----------------------------------------------------------------
create table if not exists public.pack_products (
  pack_id    text not null references public.packs (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  quantity   numeric(20, 3) not null default 1 check (quantity > 0),
  primary key (pack_id, product_id)
);
create index if not exists pack_products_product_idx on public.pack_products (product_id);

alter table public.pack_products enable row level security;
drop policy if exists pack_products_read  on public.pack_products;
drop policy if exists pack_products_write on public.pack_products;
create policy pack_products_read  on public.pack_products for select to anon, authenticated using (true);
create policy pack_products_write on public.pack_products for all to authenticated
  using (public.has_permission('packs.create') or public.has_permission('packs.edit'))
  with check (public.has_permission('packs.create') or public.has_permission('packs.edit'));

-- p_products: [{ product_id, quantity }]. save_pack() checks the permissions.
create or replace function public.save_pack_v2(p_id text, p_data jsonb, p_recipe_ids text[], p_products jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_res jsonb; v_id text;
begin
  v_res := public.save_pack(p_id, p_data, coalesce(p_recipe_ids, '{}'));
  v_id := v_res->>'id';
  delete from public.pack_products where pack_id = v_id;
  insert into public.pack_products (pack_id, product_id, quantity)
    select v_id, x->>'product_id', greatest(round(coalesce((x->>'quantity')::numeric, 1), 3), 0.001)
    from jsonb_array_elements(coalesce(p_products, '[]')) x
    where x->>'product_id' is not null
    on conflict (pack_id, product_id) do update set quantity = excluded.quantity;
  if not exists (select 1 from public.pack_recipes where pack_id = v_id) and not exists (select 1 from public.pack_products where pack_id = v_id) then
    raise exception 'empty pack' using errcode = '22023';
  end if;
  return v_res;
end $$;

-- Website: what each pack contains (safe columns only).
create or replace function public.public_pack_items()
returns table (pack_id text, item_type text, item_id text, name text, name_ar text, image_url text, quantity numeric)
language sql stable security definer set search_path = public as $$
  select pr.pack_id, 'RECIPE'::text, r.id, r.name, r.name_ar, r.image_url, 1::numeric
    from public.pack_recipes pr join public.recipes r on r.id = pr.recipe_id
  union all
  select pp.pack_id, 'PRODUCT'::text, p.id, p.name, p.name_ar, p.image_url, pp.quantity
    from public.pack_products pp join public.products p on p.id = pp.product_id
$$;

-- 4. Website products: + unit, category and quantity offers ----------------------------
drop function if exists public.public_products();
create or replace function public.public_products()
returns table (id text, name text, name_ar text, description text, description_ar text, image_url text,
               barcode text, price numeric, unit_id text, unit_symbol text, is_out_of_stock boolean, category_id text, tiers jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.name_ar, p.description, p.description_ar, p.image_url, p.barcode, p.price_detail, p.unit_id, u.symbol,
         (p.is_out_of_stock or p.stock_quantity <= 0), p.category_id,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'quantity', t.quantity, 'price', t.price) order by t.quantity)
                   from public.product_price_tiers t where t.product_id = p.id), '[]'::jsonb)
  from public.products p join public.units u on u.id = p.unit_id
  where p.is_visible_on_website order by p.name
$$;

-- 5. Personalized recipes ordered from the website --------------------------------------
alter table public.orders add column if not exists is_custom boolean not null default false;
alter table public.orders add column if not exists custom_recipe_name text not null default '';
create index if not exists orders_custom_idx on public.orders (is_custom);

-- p_items: [{ type, id, quantity, tier_id? }] — a product line with tier_id orders `quantity` × that offer.
create or replace function public.create_order_v2(
  p_full_name text, p_phone text, p_wilaya_code text, p_wilaya_name text, p_commune_name text,
  p_items jsonb, p_message text, p_wants_client_account boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_value integer; v_number text; v_order text; it jsonb; v_pos int := 0; v_total numeric := 0;
        v_qty numeric; v_name text; v_price numeric; v_ok boolean; v_line numeric; v_unit text;
        v_tier_qty numeric; v_tier_price numeric; v_first_recipe text; v_first_pack text;
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
      select p.name, p.price_detail, u.symbol, true into v_name, v_price, v_unit, v_ok
        from public.products p join public.units u on u.id = p.unit_id
        where p.id = it->>'id' and p.is_visible_on_website and not p.is_out_of_stock and p.stock_quantity > 0;
    end if;
    if not coalesce(v_ok, false) then continue; end if;
    v_line := round(v_qty * v_price, 2);
    if it->>'type' = 'PRODUCT' and nullif(it->>'tier_id', '') is not null then
      select t.quantity, t.price into v_tier_qty, v_tier_price
        from public.product_price_tiers t where t.id = it->>'tier_id' and t.product_id = it->>'id';
      if found then
        v_name := v_name || ' (' || rtrim(rtrim(v_tier_qty::text, '0'), '.') || ' ' || coalesce(v_unit, '') || ')';
        v_line := round(v_qty * v_tier_price, 2);
        v_qty := round(v_qty * v_tier_qty, 3);
        v_price := round(v_tier_price / v_tier_qty, 2);
      end if;
    end if;
    v_pos := v_pos + 1;
    insert into public.order_items (order_id, item_type, recipe_id, pack_id, product_id, name, quantity, unit_price, line_total, position)
      values (v_order, it->>'type',
              case when it->>'type' = 'RECIPE' then it->>'id' end,
              case when it->>'type' = 'PACK' then it->>'id' end,
              case when it->>'type' = 'PRODUCT' then it->>'id' end,
              v_name, v_qty, v_price, v_line, v_pos);
    v_total := v_total + v_line;
  end loop;

  if v_pos = 0 then raise exception 'no valid items' using errcode = '22023'; end if;
  -- Keep the old columns filled so existing screens keep working.
  update public.orders set total = v_total, recipe_id = v_first_recipe, pack_id = v_first_pack where id = v_order;
  return v_number;
end $$;

-- A personalized recipe: the visitor names it and picks products and quantities; staff confirm it like any order.
create or replace function public.create_custom_order(
  p_full_name text, p_phone text, p_wilaya_code text, p_wilaya_name text, p_commune_name text,
  p_recipe_name text, p_items jsonb, p_message text, p_wants_client_account boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_number text;
begin
  if coalesce(trim(p_recipe_name), '') = '' then raise exception 'missing name' using errcode = '22023'; end if;
  v_number := public.create_order_v2(p_full_name, p_phone, p_wilaya_code, p_wilaya_name, p_commune_name,
    (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x where x->>'type' = 'PRODUCT'),
    p_message, p_wants_client_account);
  update public.orders set is_custom = true, custom_recipe_name = left(trim(p_recipe_name), 120) where order_number = v_number;
  return v_number;
end $$;

-- 6. Arabic by default -------------------------------------------------------------------
alter table public.profiles alter column language set default 'ar';

-- 7. Grants ------------------------------------------------------------------------------
revoke execute on function public.save_product_tiers(text, jsonb)             from public, anon;
revoke execute on function public.save_pack_v2(text, jsonb, text[], jsonb)    from public, anon;
grant execute on function public.save_product_tiers(text, jsonb)              to authenticated;
grant execute on function public.save_pack_v2(text, jsonb, text[], jsonb)     to authenticated;
grant execute on function public.public_products()                                                               to anon, authenticated;
grant execute on function public.public_pack_items()                                                             to anon, authenticated;
grant execute on function public.create_order_v2(text, text, text, text, text, jsonb, text, boolean)             to anon, authenticated;
grant execute on function public.create_custom_order(text, text, text, text, text, text, jsonb, text, boolean)   to anon, authenticated;

-- 8. -- Backup restore (admin only): replaces every data table in one transaction. Accounts are kept;
-- clients whose Supabase account no longer exists are skipped together with their rows.
-- Tables missing from an older archive are restored empty.
create or replace function public.restore_backup(p_data jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer := 0; n integer;
begin
  if not public.is_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- Children first.
  delete from public.product_price_tiers; delete from public.pack_products;
  delete from public.payments; delete from public.stock_movements; delete from public.sale_items; delete from public.sales;
  delete from public.purchase_items; delete from public.purchases; delete from public.order_items;
  delete from public.supplier_products; delete from public.suppliers;
  delete from public.favorites; delete from public.calculation_history; delete from public.orders;
  delete from public.client_permissions; delete from public.clients; delete from public.pack_recipes;
  delete from public.packs; delete from public.recipe_ingredients; delete from public.recipes;
  delete from public.products; delete from public.categories; delete from public.units; delete from public.counters;
  delete from public.app_meta where key <> 'lastBackupAt';

  insert into public.units select * from jsonb_populate_recordset(null::public.units, coalesce(p_data->'units', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.categories select * from jsonb_populate_recordset(null::public.categories, coalesce(p_data->'categories', '[]'));
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
  insert into public.pack_products select * from jsonb_populate_recordset(null::public.pack_products, coalesce(p_data->'pack_products', '[]'));
  get diagnostics n = row_count; v_count := v_count + n;
  insert into public.product_price_tiers select * from jsonb_populate_recordset(null::public.product_price_tiers, coalesce(p_data->'product_price_tiers', '[]'));
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

-- 9. Recipe category (save_recipe() does not know the column; same permissions as saving a recipe).
create or replace function public.set_recipe_category(p_id text, p_category_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('recipes.create') or public.has_permission('recipes.edit')) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  update public.recipes set category_id = nullif(p_category_id, '') where id = p_id;
end $$;
revoke execute on function public.set_recipe_category(text, text) from public, anon;
grant execute on function public.set_recipe_category(text, text) to authenticated;
