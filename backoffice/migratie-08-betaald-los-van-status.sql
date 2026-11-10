-- ============================================================================
-- Migratie 08 — "Betaald" los van de status
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná migratie 07.
--
-- De status gaat alleen nog over de levering: Nieuw, Bevestigd, Geleverd of
-- Geannuleerd. Of een bestelling betaald is, staat los daarvan (een bestelling
-- kan al betaald zijn voordat hij geleverd is, of andersom) in de kolom
-- orders.paid_at en wordt gezet met de knop "Markeer als betaald".
--
--   1. orders.paid_at toevoegen. Bestellingen die op status Betaald stonden,
--      krijgen status Geleverd en worden als betaald gemarkeerd.
--   2. De status Betaald verdwijnt uit de toegestane statussen.
--   3. set_order_paid(): betaald zetten of ongedaan maken, met een regel in het
--      logboek (wie en wanneer).
--   4. create_manual_order(): een handmatige bestelling kan direct als betaald
--      worden aangemaakt.
-- ============================================================================

alter table public.orders add column paid_at timestamptz;

-- Eenmalig omzetten zonder dat de overgang in het logboek komt.
alter table public.orders disable trigger orders_log_status;
update public.orders set paid_at = now(), status = 'geleverd' where status = 'betaald';
alter table public.orders enable trigger orders_log_status;

alter table public.orders drop constraint orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in ('nieuw', 'bevestigd', 'geleverd', 'geannuleerd'));

alter table public.order_changes drop constraint order_changes_kind_check;
alter table public.order_changes
  add constraint order_changes_kind_check check (kind in ('status', 'items', 'created', 'payment'));


create or replace function public.set_order_paid(p_order_id uuid, p_paid boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status = 'geannuleerd' then
    raise exception 'order_cancelled';
  end if;

  if p_paid then
    if v_order.paid_at is not null then
      raise exception 'already_paid';
    end if;
    update public.orders set paid_at = now() where id = p_order_id;
  else
    if v_order.paid_at is null then
      raise exception 'not_paid';
    end if;
    update public.orders set paid_at = null where id = p_order_id;
  end if;

  insert into public.order_changes (order_id, changed_by, changed_by_email, kind, summary)
  values (
    p_order_id,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'payment',
    case when p_paid then 'Betaling ontvangen' else 'Betaling ongedaan gemaakt' end
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_order_paid(uuid, boolean) from public, anon;
grant execute on function public.set_order_paid(uuid, boolean) to authenticated;


-- Handmatige bestelling: nu met een aparte "betaald"-keuze en zonder status Betaald.
-- Verwacht in p_order: "status": nieuw | bevestigd | geleverd, en "paid": true of false.
create or replace function public.create_manual_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := btrim(coalesce(p_order ->> 'name', ''));
  v_email    text := lower(btrim(coalesce(p_order ->> 'email', '')));
  v_phone    text := nullif(btrim(coalesce(p_order ->> 'phone', '')), '');
  v_street   text := btrim(coalesce(p_order ->> 'street', ''));
  v_number   text := btrim(coalesce(p_order ->> 'house_number', ''));
  v_addition text := nullif(btrim(coalesce(p_order ->> 'addition', '')), '');
  v_postcode text := btrim(coalesce(p_order ->> 'postcode', ''));
  v_city     text := btrim(coalesce(p_order ->> 'city', ''));
  v_status   text := coalesce(nullif(btrim(coalesce(p_order ->> 'status', '')), ''), 'nieuw');
  v_paid     boolean := coalesce(p_order ->> 'paid', '') = 'true';
  v_note     text := nullif(btrim(coalesce(p_order ->> 'internal_note', '')), '');
  v_items    jsonb := p_order -> 'items';
  v_today    date := (now() at time zone 'Europe/Amsterdam')::date;
  v_date     date;
  v_created  timestamptz;
  v_total    numeric(10, 2) := 0;
  v_bottles  int := 0;
  v_text     text;
  v_order_id uuid;
  v_number_out bigint;
  it         jsonb;
  v_prod     public.products;
  v_qty      numeric;
  v_price    numeric(10, 2);
  v_seen     text[] := '{}';
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if char_length(v_name) not between 1 and 120
     or char_length(v_street) not between 1 and 120
     or char_length(v_number) not between 1 and 20
     or char_length(v_city) not between 1 and 80
     or char_length(coalesce(v_addition, '')) > 20
     or char_length(coalesce(v_phone, '')) > 40
     or char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'invalid_input';
  end if;

  -- Een e-mailadres is hier optioneel (bij een telefonische bestelling of op de markt weet je het niet altijd).
  if v_email <> '' and (char_length(v_email) > 200 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'invalid_email';
  end if;

  if v_postcode !~* '^[1-9][0-9]{3} ?[A-Z]{2}$' then
    raise exception 'invalid_postcode';
  end if;
  v_postcode := upper(regexp_replace(v_postcode, '^([0-9]{4}) ?([A-Za-z]{2})$', '\1 \2'));

  if v_status not in ('nieuw', 'bevestigd', 'geleverd') then
    raise exception 'invalid_status';
  end if;

  -- Datum: vandaag of eerder (maximaal twee jaar terug). Vandaag = nu.
  begin
    v_date := coalesce(nullif(p_order ->> 'order_date', ''), v_today::text)::date;
  exception when others then
    raise exception 'invalid_date';
  end;
  if v_date > v_today or v_date < v_today - 730 then
    raise exception 'invalid_date';
  end if;
  v_created := case when v_date = v_today then now()
                    else ((v_date::text || ' 12:00')::timestamp at time zone 'Europe/Amsterdam') end;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'no_items';
  end if;

  -- Eerst alles controleren en optellen, daarna pas schrijven.
  for it in select * from jsonb_array_elements(v_items) loop
    if jsonb_typeof(it) <> 'object' or coalesce(jsonb_typeof(it -> 'quantity'), '') <> 'number' then
      raise exception 'invalid_quantity';
    end if;
    v_qty := (it ->> 'quantity')::numeric;
    if v_qty <> floor(v_qty) or v_qty < 0 or v_qty > 99 then
      raise exception 'invalid_quantity';
    end if;
    if v_qty = 0 then
      continue;
    end if;

    select * into v_prod from public.products where slug = it ->> 'slug' and active;
    if not found then
      raise exception 'unknown_product';
    end if;
    if v_prod.slug = any (v_seen) then
      raise exception 'duplicate_product';
    end if;
    v_seen := v_seen || v_prod.slug;

    if it ? 'unit_price' and jsonb_typeof(it -> 'unit_price') <> 'null' then
      if jsonb_typeof(it -> 'unit_price') <> 'number' then
        raise exception 'invalid_price';
      end if;
      v_price := round((it ->> 'unit_price')::numeric, 2);
      if v_price < 0 or v_price >= 1000 then
        raise exception 'invalid_price';
      end if;
    else
      v_price := v_prod.price_incl;
    end if;

    v_bottles := v_bottles + v_qty::int;
    v_total := v_total + v_qty * v_price;
  end loop;

  if v_bottles = 0 then
    raise exception 'no_items';
  end if;

  insert into public.orders
    (name, email, phone, street, house_number, addition, postcode, city,
     total_incl, status, internal_note, source, created_at, paid_at)
  values
    (v_name, v_email, v_phone, v_street, v_number, v_addition, v_postcode, v_city,
     v_total, v_status, v_note, 'handmatig', v_created, case when v_paid then v_created end)
  returning id, order_number into v_order_id, v_number_out;

  for it in select * from jsonb_array_elements(v_items) loop
    v_qty := (it ->> 'quantity')::numeric;
    continue when v_qty = 0;
    select * into v_prod from public.products where slug = it ->> 'slug';
    v_price := case when it ? 'unit_price' and jsonb_typeof(it -> 'unit_price') = 'number'
                    then round((it ->> 'unit_price')::numeric, 2)
                    else v_prod.price_incl end;
    insert into public.order_items (order_id, product_slug, product_name, quantity, unit_price_incl)
    values (v_order_id, v_prod.slug, v_prod.name, v_qty::int, v_price);
  end loop;

  select string_agg(quantity || ' × ' || product_name, ', ' order by id)
    into v_text from public.order_items where order_id = v_order_id;

  insert into public.order_changes
    (order_id, changed_by, changed_by_email, kind, summary, new_total)
  values (
    v_order_id,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'created',
    'Handmatig toegevoegd (' || v_status || case when v_paid then ', betaald' else '' end || '): ' || v_text
      || case when v_date < v_today then ', besteldatum ' || to_char(v_date, 'DD-MM-YYYY') else '' end,
    v_total
  );

  return jsonb_build_object('ok', true, 'id', v_order_id, 'order_number', v_number_out, 'total', v_total);
end;
$$;

revoke all on function public.create_manual_order(jsonb) from public, anon;
grant execute on function public.create_manual_order(jsonb) to authenticated;
