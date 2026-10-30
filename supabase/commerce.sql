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
