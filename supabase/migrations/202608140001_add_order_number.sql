begin;

create sequence if not exists public.orders_order_number_seq;

alter table public.orders
  add column if not exists order_number bigint;

alter sequence public.orders_order_number_seq
  owned by public.orders.order_number;

do $$
declare
  column_type text;
  next_number bigint;
begin
  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'order_number';

  execute 'select greatest(coalesce(max(nullif(order_number::text, '''')::bigint), 0) + 1, 1) from public.orders'
    into next_number;
  perform setval('public.orders_order_number_seq', next_number, false);

  if column_type in ('text', 'character varying', 'character') then
    execute 'update public.orders set order_number = nextval(''public.orders_order_number_seq'')::text where order_number is null or btrim(order_number::text) = ''''';
    execute 'alter table public.orders alter column order_number set default (nextval(''public.orders_order_number_seq''))::text';
  else
    execute 'update public.orders set order_number = nextval(''public.orders_order_number_seq'') where order_number is null';
    execute 'alter table public.orders alter column order_number set default nextval(''public.orders_order_number_seq'')';
  end if;

  execute 'select greatest(coalesce(max(nullif(order_number::text, '''')::bigint), 0) + 1, 1) from public.orders'
    into next_number;
  perform setval('public.orders_order_number_seq', next_number, false);
end $$;

alter table public.orders alter column order_number set not null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number);

comment on column public.orders.order_number is
  'Послідовний номер замовлення для адміністративної панелі та сповіщень.';

commit;
