-- ============================================================================
-- Migratie 03 — bestellingen aanpassen met logboek, en creditnota's
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná schema.sql en migratie-02-retouren.sql.
--
-- Inhoud:
--   1. Logboek (order_changes): elke statuswijziging en elke aanpassing van een
--      bestelling wordt vastgelegd met datum, wie, en een reden. Het logboek
--      kan niet worden gewijzigd of verwijderd.
--   2. orders.edited_at: markeert een bestelling als "Aangepast".
--   3. update_order_items(): aantallen van een bestelling aanpassen. Kan alleen
--      zolang er nog geen factuur en geen retour is.
--   4. Creditnota's (credit_notes) bij een retour met terugbetaling, met eigen
--      nummer (CN2026-0001) dat zonder gaten oploopt.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1 + 2. Logboek en "Aangepast"-markering
-- ---------------------------------------------------------------------------

alter table public.orders add column edited_at timestamptz;

create table public.order_changes (
  id               bigint generated always as identity primary key,
  order_id         uuid not null references public.orders (id) on delete cascade,
  changed_at       timestamptz not null default now(),
  changed_by       uuid default auth.uid(),
  changed_by_email text,
  kind             text not null check (kind in ('status', 'items')),
  summary          text not null,
  reason           text,
  old_total        numeric(10, 2),
  new_total        numeric(10, 2)
);
create index order_changes_order_id_idx on public.order_changes (order_id);

alter table public.order_changes enable row level security;
revoke all on public.order_changes from anon, authenticated;
grant select on public.order_changes to authenticated;
create policy order_changes_read on public.order_changes for select to authenticated
  using (public.is_staff());
-- Geen insert-, update- of delete-rechten: alleen onderstaande functies schrijven erin.

-- Elke statuswijziging automatisch vastleggen.
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_changes (order_id, changed_by, changed_by_email, kind, summary)
  values (
    new.id,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'status',
    'Status: ' || old.status || ' → ' || new.status
  );
  return new;
end;
$$;

create trigger orders_log_status
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_order_status_change();


-- ---------------------------------------------------------------------------
-- 3. Bestelling aanpassen
--
-- p_items is een object met het nieuwe aantal per wijn, bijvoorbeeld
-- {"blanc": 2, "mousseux": 0}. Wijnen die je niet noemt blijven ongewijzigd.
-- Bestaande regels houden hun oorspronkelijke prijs; een nieuwe wijn krijgt
-- de huidige prijs uit "products".
-- ---------------------------------------------------------------------------

create or replace function public.update_order_items(
  p_order_id uuid,
  p_items    jsonb,
  p_reason   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     public.orders;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old_total numeric(10, 2);
  v_new_total numeric(10, 2);
  v_bottles   int;
  v_old_text  text;
  v_new_text  text;
  r           record;
  v_qty       numeric;
  v_name      text;
  v_price     numeric(10, 2);
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
  if exists (select 1 from public.invoices where order_id = p_order_id) then
    raise exception 'has_invoice';
  end if;
  if exists (select 1 from public.product_returns where order_id = p_order_id) then
    raise exception 'has_returns';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'object' then
    raise exception 'invalid_items';
  end if;
  if char_length(coalesce(v_reason, '')) > 500 then
    raise exception 'invalid_reason';
  end if;

  v_old_total := v_order.total_incl;
  select string_agg(quantity || ' × ' || product_name, ', ' order by id)
    into v_old_text
    from public.order_items where order_id = p_order_id;

  for r in select * from jsonb_each(p_items) loop
    if jsonb_typeof(r.value) <> 'number' then
      raise exception 'invalid_quantity';
    end if;
    v_qty := (r.value #>> '{}')::numeric;
    if v_qty <> floor(v_qty) or v_qty < 0 or v_qty > 99 then
      raise exception 'invalid_quantity';
    end if;

    if exists (select 1 from public.order_items where order_id = p_order_id and product_slug = r.key) then
      if v_qty = 0 then
        delete from public.order_items where order_id = p_order_id and product_slug = r.key;
      else
        update public.order_items set quantity = v_qty::int
         where order_id = p_order_id and product_slug = r.key;
      end if;
    elsif v_qty > 0 then
      select name, price_incl into v_name, v_price from public.products where slug = r.key and active;
      if not found then
        raise exception 'unknown_product';
      end if;
      insert into public.order_items (order_id, product_slug, product_name, quantity, unit_price_incl)
      values (p_order_id, r.key, v_name, v_qty::int, v_price);
    end if;
  end loop;

  select coalesce(sum(quantity * unit_price_incl), 0), coalesce(sum(quantity), 0)
    into v_new_total, v_bottles
    from public.order_items where order_id = p_order_id;

  if v_bottles = 0 then
    raise exception 'no_items';
  end if;

  select string_agg(quantity || ' × ' || product_name, ', ' order by id)
    into v_new_text
    from public.order_items where order_id = p_order_id;

  if v_new_text is not distinct from v_old_text then
    raise exception 'no_change';
  end if;

  update public.orders set total_incl = v_new_total, edited_at = now() where id = p_order_id;

  insert into public.order_changes
    (order_id, changed_by, changed_by_email, kind, summary, reason, old_total, new_total)
  values (
    p_order_id,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'items',
    'Bestelling aangepast: ' || v_old_text || ' → ' || v_new_text,
    v_reason,
    v_old_total,
    v_new_total
  );

  return jsonb_build_object('ok', true, 'old_total', v_old_total, 'new_total', v_new_total);
end;
$$;

revoke all on function public.update_order_items(uuid, jsonb, text) from public, anon;
grant execute on function public.update_order_items(uuid, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Creditnota's
--
-- Een creditnota hoort bij één retour met terugbetaling én een bestaande
-- factuur. Hij neemt de gegevens van de oorspronkelijke factuur over
-- (verkoper, klant, btw-percentage). Nummer: CN + jaar + volgnummer.
-- ---------------------------------------------------------------------------

create table public.credit_counters (
  year        int primary key,
  last_number int not null default 0
);

create table public.credit_notes (
  id          uuid primary key default gen_random_uuid(),
  credit_number text not null unique,
  invoice_id  uuid not null references public.invoices (id) on delete restrict,
  return_id   uuid not null unique references public.product_returns (id) on delete restrict,
  issued_on   date not null,
  total_incl  numeric(10, 2) not null check (total_incl > 0),
  total_excl  numeric(10, 2) not null,
  vat_amount  numeric(10, 2) not null,
  vat_rate    numeric(5, 2) not null,
  snapshot    jsonb not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

alter table public.credit_counters enable row level security;
alter table public.credit_notes    enable row level security;
revoke all on public.credit_counters, public.credit_notes from anon, authenticated;
grant select on public.credit_notes to authenticated;
create policy credit_notes_read on public.credit_notes for select to authenticated
  using (public.is_staff());

-- Een retour waar al een creditnota voor is, mag niet meer worden verwijderd.
drop policy product_returns_delete on public.product_returns;
create policy product_returns_delete on public.product_returns for delete to authenticated
  using (
    public.is_staff()
    and not exists (select 1 from public.credit_notes cn where cn.return_id = product_returns.id)
  );

create or replace function public.create_credit_note(p_return_id uuid)
returns public.credit_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ret   public.product_returns;
  v_inv   public.invoices;
  v_cn    public.credit_notes;
  v_today date := (now() at time zone 'Europe/Amsterdam')::date;
  v_year  int  := extract(year from (now() at time zone 'Europe/Amsterdam'))::int;
  v_num   int;
  v_excl  numeric(10, 2);
  v_vat   numeric(10, 2);
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select * into v_ret from public.product_returns where id = p_return_id for update;
  if not found then
    raise exception 'return_not_found';
  end if;

  select * into v_cn from public.credit_notes where return_id = p_return_id;
  if found then
    return v_cn;
  end if;

  if v_ret.refund_incl <= 0 then
    raise exception 'no_refund';
  end if;

  select * into v_inv from public.invoices where order_id = v_ret.order_id;
  if not found then
    raise exception 'no_invoice';
  end if;

  insert into public.credit_counters (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = public.credit_counters.last_number + 1
  returning last_number into v_num;

  v_excl := round(v_ret.refund_incl / (1 + v_inv.vat_rate / 100), 2);
  v_vat  := v_ret.refund_incl - v_excl;

  insert into public.credit_notes
    (credit_number, invoice_id, return_id, issued_on, total_incl, total_excl, vat_amount, vat_rate, snapshot)
  values (
    'CN' || v_year::text || '-' || lpad(v_num::text, 4, '0'),
    v_inv.id,
    p_return_id,
    v_today,
    v_ret.refund_incl,
    v_excl,
    v_vat,
    v_inv.vat_rate,
    jsonb_build_object(
      'seller', v_inv.snapshot -> 'seller',
      'customer', v_inv.snapshot -> 'customer',
      'invoice_number', v_inv.invoice_number,
      'order_number', v_inv.snapshot -> 'order_number',
      'bottles', v_ret.bottles,
      'reason', v_ret.reason
    )
  )
  returning * into v_cn;

  return v_cn;
end;
$$;

revoke all on function public.create_credit_note(uuid) from public, anon;
grant execute on function public.create_credit_note(uuid) to authenticated;
