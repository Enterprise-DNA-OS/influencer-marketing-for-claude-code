-- Influencer Marketing for Claude Code: the schema.
-- Everything a brand or agency runs its creator programme on: the brands, the creators and their
-- handles, campaigns and their budgets, each collaboration (who, what fee, which agreement, which usage
-- rights), the product sent out as gifts, every deliverable from draft to posted with its ad label,
-- the numbers each post earned, the fees paid, and every email, DM and call.
-- Plain Postgres. Runs on any Postgres 14+ and on PGlite. No extensions.

create table settings (
  key text primary key,
  value text not null,
  note text
);

-- The business day in the operator's own time zone, so "today" is theirs, not UTC's.
create or replace function biz_today() returns date language sql stable as $$
  select (now() at time zone coalesce((select value from settings where key = 'timezone'), 'Pacific/Auckland'))::date
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per brand. An agency runs several; a brand running its own programme has one.
-- category decides which advertising rules apply: therapeutic goods sold in Australia cannot use
-- paid or gifted testimonials at all (TGA Advertising Code s 24(4)).
create table brands (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'general' check (category in ('general', 'cosmetic', 'food', 'alcohol', 'therapeutic', 'financial')),
  market text not null default 'NZ' check (market in ('NZ', 'AU', 'NZ+AU')),
  currency text not null default 'NZD',
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table creators (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  email text,
  mobile text,
  city text,
  country text not null default 'NZ',
  niche text,
  status text not null default 'prospect' check (status in ('prospect', 'contacted', 'active', 'paused', 'do_not_use')),
  status_reason text,
  rate_cents bigint check (rate_cents >= 0),          -- their usual fee for one main post
  gst_registered boolean not null default false,
  agent_name text,                                     -- talent manager, if they have one
  agent_email text,
  postal_address text,                                 -- where gifts go
  external_ref text unique,                            -- the GRIN (or other) id, so a re-import creates nothing
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table creator_handles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'blog', 'other')),
  handle text not null,
  followers integer check (followers >= 0),
  engagement_rate numeric(5, 2),                       -- per cent, as the creator's media kit or insights show it
  followers_checked_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index creator_handles_unique on creator_handles (platform, lower(handle));

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand_id uuid not null references brands(id),
  name text not null,
  kind text not null default 'paid' check (kind in ('paid', 'gifting', 'affiliate', 'ugc', 'ambassador')),
  status text not null default 'planned' check (status in ('planned', 'live', 'wrapped', 'cancelled')),
  starts_on date,
  ends_on date,
  budget_cents bigint not null default 0 check (budget_cents >= 0),
  brief text,                                          -- the creative brief every creator gets
  disclosure_label text not null default '#ad',        -- the label every post in this campaign must carry upfront
  hashtag text,
  discount_prefix text,                                -- creator codes are prefix + handle, e.g. SPF-AROHA
  owner text,                                          -- who on the team runs it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One creator on one campaign: the deal itself.
create table collaborations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  campaign_id uuid not null references campaigns(id),
  creator_id uuid not null references creators(id),
  stage text not null default 'invited' check (stage in ('invited', 'accepted', 'declined', 'cancelled', 'complete')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  fee_due_days integer not null default 14 check (fee_due_days >= 0),   -- days after the last post goes up
  agreement_signed_on date,                            -- the signed brief and terms, disclosure wording included
  agreement_ref text,
  usage_rights_until date,                             -- the brand may reuse the content until this day
  usage_rights_scope text,                             -- e.g. 'organic and paid social, NZ'
  whitelisting boolean not null default false,         -- the brand may run ads from the creator's handle
  exclusivity_until date,
  exclusivity_note text,
  discount_code text unique,
  affiliate_rate numeric(5, 2),
  stage_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create table gifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  collaboration_id uuid not null references collaborations(id),
  product text not null,
  value_cents bigint not null default 0 check (value_cents >= 0),     -- at cost to the brand
  sent_on date not null,
  courier text,
  tracking text,
  delivered_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deliverables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  collaboration_id uuid not null references collaborations(id),
  kind text not null check (kind in ('post', 'reel', 'story', 'tiktok', 'video', 'short', 'ugc_asset', 'blog', 'live')),
  platform text,
  due_on date,
  draft_received_on date,
  draft_note text,
  approved_on date,
  approved_by text,
  posted_on date,
  post_url text,
  disclosure_label text,                               -- the label as it appears on the post
  label_upfront boolean,                               -- visible when the post is first seen, not after the hashtags
  is_testimonial boolean not null default false,       -- the creator describes their own use of the product
  ad_running boolean not null default false,           -- the brand is running this content as a paid ad now
  ad_running_since date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The numbers a post earned, captured from the platform's insights (screenshot, export or the creator's report).
-- One row per capture; the latest is the one that counts.
create table post_metrics (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  captured_on date not null,
  views integer not null default 0,
  reach integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  link_clicks integer not null default 0,
  code_uses integer not null default 0,
  sales_cents bigint not null default 0,
  source text,
  created_at timestamptz not null default now()
);

-- Fees owed and paid. A record, not a payment: the money moves in your bank or accounts system.
create table payments (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references collaborations(id),
  amount_cents bigint not null check (amount_cents > 0),
  due_on date,
  invoice_ref text,
  paid_on date,
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id),
  collaboration_id uuid references collaborations(id),
  kind text not null check (kind in ('email', 'dm', 'call', 'meeting', 'note')),
  direction text not null default 'out' check (direction in ('out', 'in', 'internal')),
  body text not null,
  at timestamptz not null default now(),
  by_name text,
  created_at timestamptz not null default now()
);
create index activities_creator on activities (creator_id, at desc);

do $$
declare t text;
begin
  foreach t in array array['brands', 'creators', 'creator_handles', 'campaigns', 'collaborations', 'gifts', 'deliverables', 'payments'] loop
    execute format('create trigger %I before update on %I for each row execute function touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- The latest numbers for each deliverable.
create view v_latest_metrics as
select distinct on (m.deliverable_id) m.*,
       (m.likes + m.comments + m.shares + m.saves) as engagements
from post_metrics m
order by m.deliverable_id, m.captured_on desc, m.created_at desc;

-- Each creator's biggest handle: the one people know them by.
create view v_creator_main_handle as
select distinct on (h.creator_id) h.creator_id, h.platform, h.handle, h.followers, h.engagement_rate
from creator_handles h
order by h.creator_id, h.followers desc nulls last, h.created_at;

-- Every collaboration with what it cost and earned so far.
create view v_collabs as
select k.id, k.code, k.stage, k.fee_cents, k.agreement_signed_on, k.usage_rights_until, k.whitelisting, k.discount_code,
       k.invited_at, k.responded_at, k.fee_due_days,
       cp.id as campaign_id, cp.code as campaign_code, cp.name as campaign, cp.kind as campaign_kind, cp.status as campaign_status,
       cp.disclosure_label as required_label,
       b.code as brand_code, b.name as brand, b.category as brand_category, b.market, b.currency,
       c.id as creator_id, c.code as creator_code, c.full_name as creator, c.status as creator_status, mh.handle, mh.platform, mh.followers,
       coalesce((select sum(g.value_cents) from gifts g where g.collaboration_id = k.id), 0) as gift_cents,
       coalesce((select sum(p.amount_cents) from payments p where p.collaboration_id = k.id and p.paid_on is not null), 0) as paid_cents,
       (select count(*) from deliverables d where d.collaboration_id = k.id) as deliverables,
       (select count(*) from deliverables d where d.collaboration_id = k.id and d.posted_on is not null) as posted,
       (select max(d.posted_on) from deliverables d where d.collaboration_id = k.id) as last_posted_on,
       (select min(d.due_on) from deliverables d where d.collaboration_id = k.id and d.posted_on is null) as next_due_on,
       coalesce((select sum(m.views) from v_latest_metrics m join deliverables d on d.id = m.deliverable_id where d.collaboration_id = k.id), 0) as views,
       coalesce((select sum(m.engagements) from v_latest_metrics m join deliverables d on d.id = m.deliverable_id where d.collaboration_id = k.id), 0) as engagements,
       coalesce((select sum(m.link_clicks) from v_latest_metrics m join deliverables d on d.id = m.deliverable_id where d.collaboration_id = k.id), 0) as link_clicks,
       coalesce((select sum(m.code_uses) from v_latest_metrics m join deliverables d on d.id = m.deliverable_id where d.collaboration_id = k.id), 0) as code_uses,
       coalesce((select sum(m.sales_cents) from v_latest_metrics m join deliverables d on d.id = m.deliverable_id where d.collaboration_id = k.id), 0) as sales_cents
from collaborations k
join campaigns cp on cp.id = k.campaign_id
join brands b on b.id = cp.brand_id
join creators c on c.id = k.creator_id
left join v_creator_main_handle mh on mh.creator_id = c.id;

-- Every deliverable with its state in plain words.
create view v_deliverables as
select d.id, d.code, d.kind, coalesce(d.platform, k.platform) as platform, d.due_on, d.draft_received_on, d.approved_on, d.posted_on, d.post_url,
       d.disclosure_label, d.label_upfront, d.is_testimonial, d.ad_running, d.ad_running_since,
       k.id as collab_id, k.code as collab_code, k.stage as collab_stage, k.campaign_code, k.campaign, k.brand_code, k.brand, k.brand_category, k.market,
       k.creator_code, k.creator, k.handle, k.required_label, k.usage_rights_until, k.agreement_signed_on, k.fee_cents, k.gift_cents,
       case
         when d.posted_on is not null then 'posted'
         when d.approved_on is not null then 'approved'
         when d.draft_received_on is not null then 'awaiting approval'
         when d.due_on < biz_today() then 'overdue'
         else 'due'
       end as state,
       (biz_today() - d.due_on) as days_late,
       m.captured_on as metrics_on, m.views, m.engagements, m.link_clicks, m.code_uses, m.sales_cents
from deliverables d
join v_collabs k on k.id = d.collaboration_id
left join v_latest_metrics m on m.deliverable_id = d.id;

-- Each campaign against its budget: committed in fees and gifts, paid, and what it earned.
create view v_campaign_results as
select cp.id, cp.code, cp.name, cp.kind, cp.status, cp.starts_on, cp.ends_on, cp.budget_cents, cp.owner,
       b.code as brand_code, b.name as brand, b.currency,
       count(k.id) filter (where k.stage in ('accepted', 'complete')) as creators,
       count(k.id) filter (where k.stage = 'invited') as invited,
       coalesce(sum(k.fee_cents) filter (where k.stage in ('accepted', 'complete')), 0) as fees_cents,
       coalesce(sum(k.gift_cents), 0) as gifts_cents,
       coalesce(sum(k.paid_cents), 0) as paid_cents,
       coalesce(sum(k.deliverables) filter (where k.stage in ('accepted', 'complete')), 0) as deliverables,
       coalesce(sum(k.posted), 0) as posted,
       coalesce(sum(k.views), 0) as views,
       coalesce(sum(k.engagements), 0) as engagements,
       coalesce(sum(k.link_clicks), 0) as link_clicks,
       coalesce(sum(k.code_uses), 0) as code_uses,
       coalesce(sum(k.sales_cents), 0) as sales_cents
from campaigns cp
join brands b on b.id = cp.brand_id
left join v_collabs k on k.campaign_id = cp.id
group by cp.id, b.code, b.name, b.currency;

-- Each creator across every campaign: what they cost, what they delivered, what it earned.
create view v_creator_performance as
select c.id, c.code, c.full_name as creator, c.status, mh.platform, mh.handle, mh.followers, mh.engagement_rate,
       count(k.id) filter (where k.stage in ('accepted', 'complete')) as collabs,
       -- a cancelled deal costs what was paid and sent, not the fee that was agreed
       coalesce(sum(case when k.stage in ('accepted', 'complete') then k.fee_cents + k.gift_cents
                         when k.stage = 'cancelled' then k.paid_cents + k.gift_cents else 0 end), 0) as cost_cents,
       coalesce(sum(k.deliverables) filter (where k.stage in ('accepted', 'complete', 'cancelled')), 0) as deliverables,
       coalesce(sum(k.posted), 0) as posted,
       coalesce(sum(k.views), 0) as views,
       coalesce(sum(k.engagements), 0) as engagements,
       coalesce(sum(k.code_uses), 0) as code_uses,
       coalesce(sum(k.sales_cents), 0) as sales_cents,
       (select count(*) from deliverables d join collaborations k2 on k2.id = d.collaboration_id
         where k2.creator_id = c.id and d.posted_on is not null and d.due_on is not null and d.posted_on > d.due_on) as posted_late,
       (select max(a.at) from activities a where a.creator_id = c.id) as last_contact_at
from creators c
left join v_creator_main_handle mh on mh.creator_id = c.id
left join v_collabs k on k.creator_id = c.id
group by c.id, mh.platform, mh.handle, mh.followers, mh.engagement_rate;
