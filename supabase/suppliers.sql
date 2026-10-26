-- =====================================================================================
-- Suppliers (fournisseurs) — run once in Supabase → SQL Editor (idempotent: safe to re-run).
-- Also included at the end of schema.sql for fresh installs.
-- Worker permission keys: suppliers.view  suppliers.create  suppliers.edit  suppliers.delete
-- Clients can read every supplier and its products (view only).
-- =====================================================================================

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
