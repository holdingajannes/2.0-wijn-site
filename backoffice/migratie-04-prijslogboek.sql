-- ============================================================================
-- Migratie 04 — prijswijzigingen vastleggen
--
-- Uitvoeren: Supabase -> SQL Editor -> New query -> plakken -> Run.
-- Eén keer draaien, ná migratie 03.
--
-- De prijzen kunnen in de back office worden aangepast (Instellingen). De
-- website haalt ze uit de tabel "products", dus een wijziging is direct
-- zichtbaar. Elke wijziging wordt hier automatisch vastgelegd met wie en
-- wanneer. Bestaande bestellingen behouden hun oorspronkelijke prijs.
-- ============================================================================

create table public.price_changes (
  id               bigint generated always as identity primary key,
  product_slug     text not null,
  changed_at       timestamptz not null default now(),
  changed_by       uuid default auth.uid(),
  changed_by_email text,
  old_price        numeric(10, 2) not null,
  new_price        numeric(10, 2) not null
);

alter table public.price_changes enable row level security;
revoke all on public.price_changes from anon, authenticated;
grant select on public.price_changes to authenticated;
create policy price_changes_read on public.price_changes for select to authenticated
  using (public.is_staff());

create or replace function public.log_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.price_changes (product_slug, changed_by, changed_by_email, old_price, new_price)
  values (
    new.slug,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    old.price_incl,
    new.price_incl
  );
  return new;
end;
$$;

create trigger products_log_price
  after update of price_incl on public.products
  for each row
  when (old.price_incl is distinct from new.price_incl)
  execute function public.log_price_change();

-- Een prijs moet een zinnig bedrag zijn (de website negeert alles daarbuiten).
alter table public.products
  add constraint products_price_range check (price_incl > 0 and price_incl < 1000);
