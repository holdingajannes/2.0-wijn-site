-- ============================================================================
-- Migratie 02 — retouren registreren (voor het dashboard)
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná schema.sql. Het bestaande schema blijft ongewijzigd.
--
-- Een retour hoort bij een bestelling: aantal flessen, terugbetaald bedrag
-- (incl. btw) en een reden. De controle gebeurt in de database: je kunt niet
-- meer flessen retourneren dan er zijn besteld en niet meer terugbetalen dan
-- het bestelbedrag.
-- ============================================================================

create table public.product_returns (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete restrict,
  created_at  timestamptz not null default now(),
  bottles     int not null check (bottles between 1 and 99),
  refund_incl numeric(10, 2) not null default 0 check (refund_incl >= 0),
  reason      text check (char_length(reason) <= 500),
  created_by  uuid default auth.uid()
);
create index product_returns_order_id_idx on public.product_returns (order_id);

alter table public.product_returns enable row level security;

revoke all on public.product_returns from anon, authenticated;
grant select, delete on public.product_returns to authenticated;
create policy product_returns_read on public.product_returns for select to authenticated
  using (public.is_staff());
create policy product_returns_delete on public.product_returns for delete to authenticated
  using (public.is_staff());
-- Aanmaken kan alleen via register_return() hieronder.

create or replace function public.register_return(
  p_order_id uuid,
  p_bottles  int,
  p_refund   numeric,
  p_reason   text
)
returns public.product_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_ordered  int;
  v_returned int;
  v_refunded numeric;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ret      public.product_returns;
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

  if p_bottles is null or p_bottles < 1 then
    raise exception 'invalid_bottles';
  end if;
  if p_refund is null or p_refund < 0 then
    raise exception 'invalid_refund';
  end if;
  if char_length(coalesce(v_reason, '')) > 500 then
    raise exception 'invalid_reason';
  end if;

  select coalesce(sum(quantity), 0) into v_ordered from public.order_items where order_id = p_order_id;
  select coalesce(sum(bottles), 0), coalesce(sum(refund_incl), 0)
    into v_returned, v_refunded
    from public.product_returns where order_id = p_order_id;

  if v_returned + p_bottles > v_ordered then
    raise exception 'too_many_bottles';
  end if;
  if v_refunded + round(p_refund, 2) > v_order.total_incl then
    raise exception 'refund_too_high';
  end if;

  insert into public.product_returns (order_id, bottles, refund_incl, reason)
  values (p_order_id, p_bottles, round(p_refund, 2), v_reason)
  returning * into v_ret;

  return v_ret;
end;
$$;

revoke all on function public.register_return(uuid, int, numeric, text) from public, anon;
grant execute on function public.register_return(uuid, int, numeric, text) to authenticated;
