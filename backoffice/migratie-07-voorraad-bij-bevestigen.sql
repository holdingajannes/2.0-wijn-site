-- ============================================================================
-- Migratie 07 — voorraad pas afboeken bij bevestigen, pallets uit het scherm
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná migratie 06.
--
-- Nieuwe regel: de flessen van een bestelling gaan pas van de voorraad af
-- zodra de status Bevestigd, Geleverd of Betaald is. Bij Nieuw gebeurt er niets;
-- wordt een bestelling geannuleerd (of teruggezet naar Nieuw), dan komen de
-- flessen weer terug. Een bestelling aanpassen boekt het verschil, maar alleen
-- als hij op dat moment al is afgeboekt.
--
-- Bestellingen die onder de oude regel al waren afgeboekt terwijl ze nog op
-- Nieuw staan, worden in deze migratie één keer rechtgezet.
--
-- Pallets: de invoer in pallets verdwijnt (voorlopig). Voorraad boek je bij
-- als losse flessen. De bijbehorende kolommen blijven in de database staan.
-- ============================================================================

-- Zet de voorraad van één bestelling op wat hij volgens de status moet zijn.
-- Herhaald aanroepen is veilig: er wordt alleen het verschil geboekt.
create or replace function public.reconcile_order_stock(p_order_id uuid, p_kind text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders;
  v_counts boolean;
  v_email  text := coalesce((select email from auth.users where id = auth.uid()), 'systeem');
  r        record;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;
  v_counts := v_order.status in ('bevestigd', 'geleverd', 'betaald');

  for r in
    select s.slug,
           (case when v_counts then -coalesce(i.qty, 0) else 0 end) - coalesce(b.booked, 0) as delta
      from (select product_slug as slug from public.order_items where order_id = p_order_id
            union
            select product_slug from public.stock_movements where order_id = p_order_id) s
      left join (select product_slug, sum(quantity)::int as qty
                   from public.order_items where order_id = p_order_id group by product_slug) i
             on i.product_slug = s.slug
      left join (select product_slug, sum(delta)::int as booked
                   from public.stock_movements where order_id = p_order_id group by product_slug) b
             on b.product_slug = s.slug
  loop
    continue when r.delta = 0;
    insert into public.stock_movements (product_slug, kind, delta, order_id, note, created_by_email)
    values (r.slug, p_kind, r.delta, p_order_id, p_note, v_email);
  end loop;
end;
$$;

revoke all on function public.reconcile_order_stock(uuid, text, text) from public, anon, authenticated;


-- Bestelregels: bij een wijziging de voorraad van deze bestelling bijwerken.
create or replace function public.stock_on_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  v_number   bigint;
begin
  select order_number into v_number from public.orders where id = v_order_id;
  if not found then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.reconcile_order_stock(v_order_id, 'bestelling', 'Bestelling #' || v_number);
  else
    perform public.reconcile_order_stock(v_order_id, 'aanpassing', 'Bestelling #' || v_number || ' aangepast');
  end if;
  return null;
end;
$$;


-- Statuswijziging: afboeken zodra de bestelling bevestigd is, terugboeken als hij dat niet meer is.
create or replace function public.stock_on_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old boolean := old.status in ('bevestigd', 'geleverd', 'betaald');
  v_new boolean := new.status in ('bevestigd', 'geleverd', 'betaald');
begin
  if v_old = v_new then
    return null;
  end if;
  if v_new then
    perform public.reconcile_order_stock(new.id, 'bestelling', 'Bestelling #' || new.order_number || ' ' || new.status);
  elsif new.status = 'geannuleerd' then
    perform public.reconcile_order_stock(new.id, 'annulering', 'Bestelling #' || new.order_number || ' geannuleerd');
  else
    perform public.reconcile_order_stock(new.id, 'annulering', 'Bestelling #' || new.order_number || ' teruggezet naar ' || new.status);
  end if;
  return null;
end;
$$;


-- Eenmalig: bestellingen die al waren afgeboekt onder de oude regel rechtzetten.
do $$
declare
  o record;
begin
  for o in select distinct order_id from public.stock_movements where order_id is not null loop
    perform public.reconcile_order_stock(o.order_id, 'annulering', 'Voorraad wordt pas afgeboekt bij bevestigen');
  end loop;
end;
$$;


-- Voorraad bijboeken: alleen nog losse flessen (geen pallets).
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
  v_current int;
  v_delta   int;
  it        jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('losse_flessen', 'sample', 'breuk', 'retour', 'telling') then
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

    insert into public.stock_levels (product_slug) values (v_slug) on conflict do nothing;
    select quantity into v_current from public.stock_levels where product_slug = v_slug for update;

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
  end loop;

  if v_count = 0 then
    raise exception 'no_change';
  end if;

  return jsonb_build_object('ok', true, 'lines', v_count);
end;
$$;

revoke all on function public.add_stock_movements(text, jsonb, text) from public, anon;
grant execute on function public.add_stock_movements(text, jsonb, text) to authenticated;
