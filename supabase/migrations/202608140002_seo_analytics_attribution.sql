begin;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('visit','search','product_view','add_to_cart','checkout_start','order','zero_result_lead')),
  session_id text,
  page_path text,
  query text,
  normalized_query text,
  result_count integer check (result_count is null or result_count >= 0),
  product_id text,
  product_number text,
  event_value numeric(14,2) not null default 0 check (event_value >= 0),
  source text,
  medium text,
  campaign text,
  referrer text,
  landing_path text,
  ip_hash text,
  user_agent_family text
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_lost_demand_idx on public.analytics_events (normalized_query, created_at desc) where event_type = 'search' and result_count = 0;

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
comment on table public.analytics_events is 'Anonymous first-party search/funnel events; writes and reads only through the service-role API.';

alter table public.orders add column if not exists source text;
alter table public.orders add column if not exists medium text;
alter table public.orders add column if not exists campaign text;
alter table public.orders add column if not exists gclid text;
alter table public.orders add column if not exists referrer text;
alter table public.orders add column if not exists landing_path text;

create or replace view public.analytics_lost_demand_30d as
select normalized_query, count(*)::bigint as searches, max(created_at) as last_searched_at
from public.analytics_events
where event_type = 'search' and result_count = 0 and created_at >= now() - interval '30 days'
group by normalized_query
order by searches desc, last_searched_at desc;

revoke all on public.analytics_lost_demand_30d from anon, authenticated;

create or replace function public.analytics_dashboard(p_days integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with bounds as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as since),
  recent as (select * from public.analytics_events where created_at >= (select since from bounds)),
  funnel as (
    select jsonb_build_object(
      'visitors', count(distinct session_id),
      'searches', count(*) filter (where event_type='search'),
      'found', count(*) filter (where event_type='search' and result_count>0),
      'add_to_cart', count(*) filter (where event_type='add_to_cart'),
      'checkout_start', count(*) filter (where event_type='checkout_start'),
      'orders', count(*) filter (where event_type='order'),
      'zero_results', count(*) filter (where event_type='search' and result_count=0),
      'zero_result_leads', count(*) filter (where event_type='zero_result_lead')
    ) value from recent
  ),
  lost as (
    select coalesce(jsonb_agg(jsonb_build_object('query', normalized_query, 'searches', searches) order by searches desc), '[]'::jsonb) value
    from (select normalized_query, count(*) searches from recent where event_type='search' and result_count=0 and normalized_query is not null group by normalized_query order by searches desc limit 50) ranked
  ),
  sources as (
    select coalesce(jsonb_agg(jsonb_build_object('source', label, 'orders', orders, 'revenue', revenue) order by revenue desc), '[]'::jsonb) value
    from (select concat_ws(' / ', coalesce(source,'direct'), coalesce(medium,'none'), nullif(campaign,'')) label, count(*) orders, sum(event_value) revenue from recent where event_type='order' group by 1) ranked
  )
  select jsonb_build_object('days', greatest(1, least(coalesce(p_days,30),365)), 'funnel', funnel.value, 'lost_demand', lost.value, 'sources', sources.value) from funnel, lost, sources;
$$;

revoke all on function public.analytics_dashboard(integer) from public, anon, authenticated;
grant execute on function public.analytics_dashboard(integer) to service_role;

commit;
