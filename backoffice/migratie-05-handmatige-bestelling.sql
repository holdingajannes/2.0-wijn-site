-- ============================================================================
-- Migratie 05 — bestellingen handmatig toevoegen
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná migratie 04.
--
-- Niet elke bestelling loopt via de website (telefoon, proeverij, markt).
-- Medewerkers kunnen in de back office zelf een bestelling invoeren.
--   1. orders.source: 'website' of 'handmatig', zodat je het verschil ziet.
--   2. Het logboek krijgt een regel "Handmatig toegevoegd" met wie en wanneer.
--   3. create_manual_order(): maakt de bestelling in één keer aan, met
--      begindatum, beginstatus en eventueel een afwijkende prijs per wijn.
-- Daarna werkt de bestelling hetzelfde als elke andere: aanpassen (zolang er
-- geen factuur is), factuur, retour, creditnota, dashboard en CSV.
-- ============================================================================

alter table public.orders
  add column source text not null default 'website'
  check (source in ('website', 'handmatig'));

alter table public.order_changes drop constraint order_changes_kind_check;
alter table public.order_changes
  add constraint order_changes_kind_check check (kind in ('status', 'items', 'created'));


-- p_order is een object, bijvoorbeeld:
--   { "name": "...", "email": "" (mag leeg), "phone": "", "street": "...",
--     "house_number": "...", "addition": "", "postcode": "1234 AB", "city": "...",
--     "status": "nieuw|bevestigd|geleverd|betaald", "order_date": "2026-11-10",
--     "internal_note": "",
--     "items": [ { "slug": "blanc", "quantity": 2, "unit_price": 10.95 } ] }
-- Een ontbrekende unit_price betekent: de huidige prijs uit "products".
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

  if v_status not in ('nieuw', 'bevestigd', 'geleverd', 'betaald') then
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
     total_incl, status, internal_note, source, created_at)
  values
    (v_name, v_email, v_phone, v_street, v_number, v_addition, v_postcode, v_city,
     v_total, v_status, v_note, 'handmatig', v_created)
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
    'Handmatig toegevoegd (' || v_status || '): ' || v_text
      || case when v_date < v_today then ', besteldatum ' || to_char(v_date, 'DD-MM-YYYY') else '' end,
    v_total
  );

  return jsonb_build_object('ok', true, 'id', v_order_id, 'order_number', v_number_out, 'total', v_total);
end;
$$;

revoke all on function public.create_manual_order(jsonb) from public, anon;
grant execute on function public.create_manual_order(jsonb) to authenticated;
