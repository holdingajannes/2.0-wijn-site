-- ============================================================================
-- Druif & Draad back office — database
--
-- Uitvoeren: Supabase dashboard -> SQL Editor -> New query -> plakken -> Run.
-- Het script mag je één keer draaien op een leeg project.
--
-- Beveiliging in het kort:
--   * Bezoekers van de website (rol "anon") kunnen ALLEEN de functie
--     submit_order() aanroepen en de productprijzen lezen. Ze kunnen geen
--     bestellingen, klantgegevens of facturen lezen.
--   * Alleen ingelogde gebruikers die in de tabel "staff" staan kunnen de
--     back office gebruiken. Een account zonder staff-rij ziet niets.
--   * De prijs van een bestelling wordt in de database berekend, niet
--     vertrouwd van de website.
--   * Facturen kunnen niet worden gewijzigd of verwijderd en het
--     factuurnummer loopt zonder gaten op.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.products (
  slug       text primary key,
  name       text not null,
  price_incl numeric(10, 2) not null check (price_incl >= 0),
  sort_order int not null default 0,
  active     boolean not null default true
);

-- Gegevens die op de factuur komen. Eén rij (id = 1), aan te passen in de back office.
create table public.settings (
  id             int primary key default 1 check (id = 1),
  company_name   text not null default 'Druif & Draad Wijnimport',
  address_line1  text not null default '',
  postcode_city  text not null default '',
  email          text not null default 'info@druifendraad.nl',
  phone          text not null default '06 24 60 73 20',
  kvk            text not null default '',
  vat_number     text not null default '',
  iban           text not null default '',
  vat_rate       numeric(5, 2) not null default 21.00 check (vat_rate >= 0 and vat_rate < 100),
  payment_days   int not null default 14 check (payment_days >= 0 and payment_days <= 365),
  invoice_prefix text not null default '' check (length(invoice_prefix) <= 10),
  footer_note    text not null default ''
);

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  bigint generated always as identity (start with 1001) unique,
  created_at    timestamptz not null default now(),
  status        text not null default 'nieuw'
                check (status in ('nieuw', 'bevestigd', 'geleverd', 'betaald', 'geannuleerd')),
  name          text not null,
  email         text not null,
  phone         text,
  street        text not null,
  house_number  text not null,
  addition      text,
  postcode      text not null,
  city          text not null,
  message       text,
  total_incl    numeric(10, 2) not null,
  internal_note text
);

create table public.order_items (
  id              bigint generated always as identity primary key,
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_slug    text not null,
  product_name    text not null,
  quantity        int not null check (quantity between 1 and 99),
  unit_price_incl numeric(10, 2) not null
);
create index order_items_order_id_idx on public.order_items (order_id);

create table public.invoice_counters (
  year        int primary key,
  last_number int not null default 0
);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id       uuid not null unique references public.orders (id) on delete restrict,
  issued_on      date not null,
  due_on         date not null,
  total_incl     numeric(10, 2) not null,
  total_excl     numeric(10, 2) not null,
  vat_amount     numeric(10, 2) not null,
  vat_rate       numeric(5, 2) not null,
  snapshot       jsonb not null,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- Startgegevens
-- ---------------------------------------------------------------------------

insert into public.products (slug, name, price_incl, sort_order) values
  ('blanc',    'Blanc',    10.95, 1),
  ('rouge',    'Rouge',    10.95, 2),
  ('rose',     'Rosé',     10.95, 3),
  ('mousseux', 'Mousseux', 13.95, 4);

insert into public.settings (id) values (1);


-- ---------------------------------------------------------------------------
-- Wie mag de back office gebruiken?
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;


-- ---------------------------------------------------------------------------
-- Rechten (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.staff            enable row level security;
alter table public.products         enable row level security;
alter table public.settings         enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices         enable row level security;

-- Eerst alles dichtzetten, daarna precies de rechten geven die nodig zijn.
revoke all on public.staff, public.products, public.settings, public.orders,
              public.order_items, public.invoice_counters, public.invoices
  from anon, authenticated;

-- Producten: prijzen zijn publiek, wijzigen mag alleen staff.
grant select on public.products to anon, authenticated;
grant update (name, price_incl, active, sort_order) on public.products to authenticated;
create policy products_read   on public.products for select to anon, authenticated using (true);
create policy products_update on public.products for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Staff: je mag alleen je eigen rij zien (de back office gebruikt dat om toegang te controleren).
grant select on public.staff to authenticated;
create policy staff_read_own on public.staff for select to authenticated
  using (user_id = auth.uid());

-- Instellingen
grant select, update on public.settings to authenticated;
create policy settings_read   on public.settings for select to authenticated using (public.is_staff());
create policy settings_update on public.settings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Bestellingen: lezen en status/notitie/adres aanpassen, nooit verwijderen.
grant select on public.orders to authenticated;
grant update (status, internal_note, name, email, phone, street, house_number, addition, postcode, city)
  on public.orders to authenticated;
create policy orders_read   on public.orders for select to authenticated using (public.is_staff());
create policy orders_update on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

grant select on public.order_items to authenticated;
create policy order_items_read on public.order_items for select to authenticated using (public.is_staff());

-- Facturen: alleen lezen. Aanmaken gaat uitsluitend via create_invoice().
grant select on public.invoices to authenticated;
create policy invoices_read on public.invoices for select to authenticated using (public.is_staff());

-- invoice_counters heeft bewust geen policies: alleen create_invoice() raakt hem aan.


-- ---------------------------------------------------------------------------
-- Bestelling plaatsen (aangeroepen door de website)
--
-- De website stuurt alleen aantallen per wijn. Prijzen en totaal worden hier
-- uit de tabel "products" berekend. Stuurt de website een ander verwacht totaal
-- mee (bijvoorbeeld door een oude pagina in de cache), dan wordt de bestelling
-- geweigerd met "price_mismatch".
-- ---------------------------------------------------------------------------

create or replace function public.submit_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := btrim(coalesce(payload ->> 'name', ''));
  v_email    text := btrim(coalesce(payload ->> 'email', ''));
  v_phone    text := nullif(btrim(coalesce(payload ->> 'phone', '')), '');
  v_street   text := btrim(coalesce(payload ->> 'street', ''));
  v_number   text := btrim(coalesce(payload ->> 'house_number', ''));
  v_addition text := nullif(btrim(coalesce(payload ->> 'addition', '')), '');
  v_postcode text := btrim(coalesce(payload ->> 'postcode', ''));
  v_city     text := btrim(coalesce(payload ->> 'city', ''));
  v_message  text := nullif(btrim(coalesce(payload ->> 'message', '')), '');
  v_items    jsonb := payload -> 'items';
  v_expected numeric;
  v_total    numeric(10, 2) := 0;
  v_count    int := 0;
  v_qty      numeric;
  v_order_id uuid;
  v_number_out bigint;
  p          record;
begin
  -- Spam-val: een verborgen veld dat echte bezoekers niet invullen.
  if btrim(coalesce(payload ->> '_gotcha', '')) <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if char_length(v_name) not between 1 and 120
     or char_length(v_street) not between 1 and 120
     or char_length(v_number) not between 1 and 20
     or char_length(v_city) not between 1 and 80
     or char_length(coalesce(v_addition, '')) > 20
     or char_length(coalesce(v_phone, '')) > 40
     or char_length(coalesce(v_message, '')) > 2000 then
    raise exception 'invalid_input';
  end if;

  if char_length(v_email) > 200 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;

  if v_postcode !~* '^[1-9][0-9]{3} ?[A-Z]{2}$' then
    raise exception 'invalid_postcode';
  end if;
  v_postcode := upper(regexp_replace(v_postcode, '^([0-9]{4}) ?([A-Za-z]{2})$', '\1 \2'));

  if v_items is null or jsonb_typeof(v_items) <> 'object' then
    raise exception 'no_items';
  end if;

  -- Rem op misbruik: te veel bestellingen in korte tijd.
  if (select count(*) from public.orders where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'too_many';
  end if;

  for p in select * from public.products where active order by sort_order loop
    if v_items ? p.slug then
      if jsonb_typeof(v_items -> p.slug) <> 'number' then
        raise exception 'invalid_quantity';
      end if;
      v_qty := (v_items ->> p.slug)::numeric;
      if v_qty <> floor(v_qty) or v_qty < 0 or v_qty > 99 then
        raise exception 'invalid_quantity';
      end if;
      if v_qty > 0 then
        v_count := v_count + 1;
        v_total := v_total + v_qty * p.price_incl;
      end if;
    end if;
  end loop;

  if v_count = 0 then
    raise exception 'no_items';
  end if;

  if payload ? 'expected_total' then
    begin
      v_expected := (payload ->> 'expected_total')::numeric;
    exception when others then
      raise exception 'price_mismatch';
    end;
    if abs(v_expected - v_total) > 0.005 then
      raise exception 'price_mismatch';
    end if;
  end if;

  insert into public.orders (name, email, phone, street, house_number, addition, postcode, city, message, total_incl)
  values (v_name, v_email, v_phone, v_street, v_number, v_addition, v_postcode, v_city, v_message, v_total)
  returning id, order_number into v_order_id, v_number_out;

  insert into public.order_items (order_id, product_slug, product_name, quantity, unit_price_incl)
  select v_order_id, pr.slug, pr.name, (v_items ->> pr.slug)::numeric::int, pr.price_incl
  from public.products pr
  where pr.active
    and v_items ? pr.slug
    and (v_items ->> pr.slug)::numeric > 0
  order by pr.sort_order;

  return jsonb_build_object('ok', true, 'order_number', v_number_out, 'total', v_total);
end;
$$;

revoke all on function public.submit_order(jsonb) from public;
grant execute on function public.submit_order(jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Factuur maken (aangeroepen door de back office)
--
-- * Alleen staff.
-- * Eén factuur per bestelling; bestaat hij al, dan krijg je die terug.
-- * Factuurnummer: [prefix]JAAR-0001, oplopend per jaar, zonder gaten
--   (alles gebeurt in één transactie).
-- * Bedrijfs- en klantgegevens worden vastgelegd in "snapshot", zodat een
--   latere wijziging van de instellingen een uitgegeven factuur niet verandert.
-- ---------------------------------------------------------------------------

create or replace function public.create_invoice(p_order_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders;
  v_set    public.settings;
  v_inv    public.invoices;
  v_today  date := (now() at time zone 'Europe/Amsterdam')::date;
  v_year   int  := extract(year from (now() at time zone 'Europe/Amsterdam'))::int;
  v_num    int;
  v_excl   numeric(10, 2);
  v_vat    numeric(10, 2);
  v_lines  jsonb;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  select * into v_inv from public.invoices where order_id = p_order_id;
  if found then
    return v_inv;
  end if;

  if v_order.status = 'geannuleerd' then
    raise exception 'order_cancelled';
  end if;

  select * into v_set from public.settings where id = 1;

  insert into public.invoice_counters (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v_num;

  v_excl := round(v_order.total_incl / (1 + v_set.vat_rate / 100), 2);
  v_vat  := v_order.total_incl - v_excl;

  select jsonb_agg(jsonb_build_object(
           'name', oi.product_name,
           'quantity', oi.quantity,
           'unit_price_incl', oi.unit_price_incl,
           'line_total_incl', oi.quantity * oi.unit_price_incl
         ) order by oi.id)
    into v_lines
    from public.order_items oi
   where oi.order_id = p_order_id;

  insert into public.invoices
    (invoice_number, order_id, issued_on, due_on, total_incl, total_excl, vat_amount, vat_rate, snapshot)
  values (
    v_set.invoice_prefix || v_year::text || '-' || lpad(v_num::text, 4, '0'),
    p_order_id,
    v_today,
    v_today + v_set.payment_days,
    v_order.total_incl,
    v_excl,
    v_vat,
    v_set.vat_rate,
    jsonb_build_object(
      'seller', to_jsonb(v_set) - 'id',
      'customer', jsonb_build_object(
        'name', v_order.name,
        'email', v_order.email,
        'street', v_order.street,
        'house_number', v_order.house_number,
        'addition', v_order.addition,
        'postcode', v_order.postcode,
        'city', v_order.city
      ),
      'order_number', v_order.order_number,
      'lines', coalesce(v_lines, '[]'::jsonb)
    )
  )
  returning * into v_inv;

  return v_inv;
end;
$$;

revoke all on function public.create_invoice(uuid) from public, anon;
grant execute on function public.create_invoice(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Nadat de gebruikers zijn aangemaakt (Authentication -> Users -> Add user)
-- geef je ze toegang met onderstaande regel. Vul de echte e-mailadressen in
-- en voer HET LOS UIT (niet als onderdeel van het eerste script).
--
--   insert into public.staff (user_id)
--   select id from auth.users
--   where email in ('naam1@voorbeeld.nl', 'naam2@voorbeeld.nl');
-- ---------------------------------------------------------------------------
