-- LOOT local-only payment simulator. No provider credentials or API calls.
alter table public.orders
  add column if not exists payment_provider text not null default 'local_test',
  add column if not exists payment_session_id text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_payment_session_id_unique
  on public.orders (payment_session_id)
  where payment_session_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_provider_local_test_check') then
    alter table public.orders add constraint orders_payment_provider_local_test_check
      check (payment_provider = 'local_test');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending', 'paid', 'failed', 'cancelled'));
  end if;
end $$;

alter table public.orders enable row level security;