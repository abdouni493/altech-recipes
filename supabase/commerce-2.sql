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
