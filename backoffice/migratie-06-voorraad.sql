-- ============================================================================
-- Migratie 06 — voorraadbeheer
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná migratie 05.
--
-- Hoe het werkt
--   * Elke verandering van de voorraad is een regel in "stock_movements"
--     (wat, hoeveel, wanneer, wie, waarom). Die regels kun je niet wijzigen of
--     verwijderen. De actuele voorraad per wijn staat in "stock_levels" en
--     wordt automatisch bijgehouden.
--   * Automatisch: een nieuwe bestelling (website of handmatig) boekt de
--     flessen af. Een bestelling aanpassen boekt het verschil. Een bestelling
--     annuleren boekt de flessen terug; weer heropenen boekt ze opnieuw af.
--   * Handmatig (via add_stock_movements): binnenkomst in pallets, binnenkomst
--     als losse flessen, samples, breuk/verlies, retour terug op voorraad, en
--     een telling (stelt de voorraad op het getelde aantal; zo zet je ook de
--     beginstand).
--   * Bestellingen worden nooit geweigerd omdat de voorraad op is: de
--     voorraad kan onder nul komen en de back office toont dat dan in rood.
--   * Bestellingen van vóór deze migratie tellen niet mee. Zet de beginstand
--     daarom ná deze migratie met een telling.
-- ============================================================================

create table public.stock_levels (
  product_slug       text primary key references public.products (slug) on delete cascade,
  quantity           int not null default 0,
  bottles_per_pallet int check (bottles_per_pallet is null or bottles_per_pallet between 1 and 5000)
);

insert into public.stock_levels (product_slug)
select slug from public.products;

create table public.stock_movements (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  created_by_email text,
  product_slug     text not null references public.products (slug),
  kind             text not null check (kind in
                     ('bestelling', 'aanpassing', 'annulering', 'pallet', 'losse_flessen', 'sample', 'breuk', 'retour', 'telling')),
  delta            int  not null check (delta <> 0),
  pallets          int,
  per_pallet       int,
  order_id         uuid references public.orders (id) on delete set null,
  note             text
);
create index stock_movements_created_idx on public.stock_movements (created_at desc);
create index stock_movements_order_idx   on public.stock_movements (order_id);

alter table public.stock_levels    enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.stock_levels, public.stock_movements from anon, authenticated;

grant select on public.stock_levels, public.stock_movements to authenticated;
-- Het aantal flessen per pallet mag staff aanpassen; het aantal op voorraad niet (alleen via de regels).
grant update (bottles_per_pallet) on public.stock_levels to authenticated;
create policy stock_levels_read on public.stock_levels for select to authenticated using (public.is_staff());
create policy stock_levels_update on public.stock_levels for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy stock_movements_read on public.stock_movements for select to authenticated using (public.is_staff());


-- Elke nieuwe regel telt direct mee in de actuele voorraad.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.stock_levels (product_slug, quantity)
  values (new.product_slug, new.delta)
  on conflict (product_slug) do update
    set quantity = public.stock_levels.quantity + new.delta;
  return new;
end;
$$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();


-- ---------------------------------------------------------------------------
-- Automatisch: bestelregels
-- ---------------------------------------------------------------------------

create or replace function public.stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  v_order    public.orders;
  v_email    text := (select email from auth.users where id = auth.uid());
begin
  select * into v_order from public.orders where id = v_order_id;
  -- Bestelling bestaat niet meer, of is geannuleerd (dan is de voorraad al teruggeboekt).
  if not found or v_order.status = 'geannuleerd' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
    values (new.product_slug, 'bestelling', -new.quantity, v_order_id, 'Bestelling #' || v_order.order_number, v_email);
  elsif tg_op = 'UPDATE' then
    if new.quantity <> old.quantity then
      insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
      values (new.product_slug, 'aanpassing', old.quantity - new.quantity, v_order_id,
              'Bestelling #' || v_order.order_number || ' aangepast', v_email);
    end if;
  else
    insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
    values (old.product_slug, 'aanpassing', old.quantity, v_order_id,
            'Bestelling #' || v_order.order_number || ' aangepast', v_email);
  end if;
  return null;
end;
$$;

create trigger order_items_stock
  after insert or update of quantity or delete on public.order_items
  for each row execute function public.stock_on_order_item();


-- ---------------------------------------------------------------------------
-- Automatisch: annuleren en heropenen
-- Er wordt alleen teruggeboekt wat voor deze bestelling is afgeboekt, zodat
-- de voorraad nooit onterecht stijgt.
-- ---------------------------------------------------------------------------

create or replace function public.stock_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_email text := (select email from auth.users where id = auth.uid());
begin
  if new.status = 'geannuleerd' and old.status <> 'geannuleerd' then
    for r in
      select product_slug, sum(delta)::int as booked
        from public.stock_movements where order_id = new.id
       group by product_slug having sum(delta) <> 0
    loop
      insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
      values (r.product_slug, 'annulering', -r.booked, new.id,
              'Bestelling #' || new.order_number || ' geannuleerd', v_email);
    end loop;
  elsif old.status = 'geannuleerd' and new.status <> 'geannuleerd' then
    for r in
      select oi.product_slug,
             (-oi.quantity - coalesce((select sum(m.delta) from public.stock_movements m
                                        where m.order_id = new.id and m.product_slug = oi.product_slug), 0))::int as delta
        from public.order_items oi where oi.order_id = new.id
    loop
      continue when r.delta = 0;
      insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
      values (r.product_slug, 'bestelling', r.delta, new.id,
              'Bestelling #' || new.order_number || ' heropend', v_email);
    end loop;
  end if;
  return null;
end;
$$;

create trigger orders_stock_status
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.stock_on_order_status();


-- ---------------------------------------------------------------------------
-- Handmatig: voorraad bijboeken of afboeken
--
-- p_kind:  pallet | losse_flessen | sample | breuk | retour | telling
-- p_lines: [ { "slug": "blanc", "quantity": 120 } , ... ]
--          bij "pallet": { "slug", "pallets": 2, "per_pallet": 600 }
--          bij "telling": quantity = het getelde aantal (0 is toegestaan);
--                         de regel is het verschil met de voorraad nu.
-- Alles gebeurt in één keer: bij een fout wordt er niets opgeslagen.
-- ---------------------------------------------------------------------------

create or replace function public.add_stock_movements(p_kind text, p_lines jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_email   text := (select email from auth.users where id = auth.uid());
  v_count   int := 0;
  v_seen    text[] := '{}';
  v_slug    text;
  v_qty     numeric;
  v_pallets numeric;
  v_per     numeric;
  v_current int;
  v_delta   int;
  it        jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('pallet', 'losse_flessen', 'sample', 'breuk', 'retour', 'telling') then
    raise exception 'invalid_kind';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'invalid_note';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'no_items';
  end if;

  for it in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'invalid_quantity';
    end if;
    v_slug := it ->> 'slug';
    if not exists (select 1 from public.products where slug = v_slug) then
      raise exception 'unknown_product';
    end if;
    if v_slug = any (v_seen) then
      raise exception 'duplicate_product';
    end if;
    v_seen := v_seen || v_slug;

    -- Zorg dat er een voorraadrij is en vergrendel hem tijdens deze boeking.
    insert into public.stock_levels (product_slug) values (v_slug) on conflict do nothing;
    select quantity into v_current from public.stock_levels where product_slug = v_slug for update;

    if p_kind = 'pallet' then
      if coalesce(jsonb_typeof(it -> 'pallets'), '') <> 'number' or coalesce(jsonb_typeof(it -> 'per_pallet'), '') <> 'number' then
        raise exception 'invalid_pallets';
      end if;
      v_pallets := (it ->> 'pallets')::numeric;
      v_per := (it ->> 'per_pallet')::numeric;
      if v_pallets <> floor(v_pallets) or v_pallets < 1 or v_pallets > 999
         or v_per <> floor(v_per) or v_per < 1 or v_per > 5000 then
        raise exception 'invalid_pallets';
      end if;
      v_delta := (v_pallets * v_per)::int;
      insert into public.stock_movements (product_slug, kind, delta, pallets, per_pallet, note, created_by_email)
      values (v_slug, 'pallet', v_delta, v_pallets::int, v_per::int, v_note, v_email);
      -- Onthoud het aantal flessen per pallet voor de volgende keer.
      update public.stock_levels set bottles_per_pallet = v_per::int where product_slug = v_slug;
      v_count := v_count + 1;

    else
      if coalesce(jsonb_typeof(it -> 'quantity'), '') <> 'number' then
        raise exception 'invalid_quantity';
      end if;
      v_qty := (it ->> 'quantity')::numeric;
      if v_qty <> floor(v_qty) or v_qty < 0 or v_qty > 1000000 then
        raise exception 'invalid_quantity';
      end if;

      if p_kind = 'telling' then
        v_delta := v_qty::int - v_current;
        if v_delta <> 0 then
          insert into public.stock_movements (product_slug, kind, delta, note, created_by_email)
          values (v_slug, 'telling', v_delta, coalesce(v_note, '') || case when v_note is null then '' else ' — ' end
                  || 'geteld: ' || v_qty::int || ' (was ' || v_current || ')', v_email);
          v_count := v_count + 1;
        end if;
      else
        if v_qty < 1 then
          raise exception 'invalid_quantity';
        end if;
        insert into public.stock_movements (product_slug, kind, delta, note, created_by_email)
        values (v_slug, p_kind,
                case when p_kind in ('sample', 'breuk') then -v_qty::int else v_qty::int end,
                v_note, v_email);
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'no_change';
  end if;

  return jsonb_build_object('ok', true, 'lines', v_count);
end;
$$;

revoke all on function public.add_stock_movements(text, jsonb, text) from public, anon;
grant execute on function public.add_stock_movements(text, jsonb, text) to authenticated;
