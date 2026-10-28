-- Demo data: Harbour & Co, a fictional Auckland agency running creator programmes for three brands:
-- Tide & Fern Skincare (NZ), Southern Roast Coffee (NZ) and Kowhai Vitamins (sold in Australia, so
-- therapeutic goods rules apply). Twelve creators, five campaigns and thirteen collaborations in every
-- state: a reel posted with #ad upfront and its fee now overdue, a gifted post whose #ad sits at the end
-- after nine other hashtags, a paid testimonial for a vitamin in Australia, a whitelisted ad still
-- running five days after its usage rights ran out, a TikTok three days late from a creator with no
-- signed agreement, a gift that never arrived, and an invite nobody answered.
-- Every date is relative to today, so the demo always reads like this week. Coded rows skip what is
-- already there; metrics and the activity history load once (the demo_seeded marker).

insert into settings (key, value, note) values
  ('timezone', 'Pacific/Auckland', 'Your time zone. Today, due dates and overdue use it.'),
  ('business_name', 'Harbour & Co', 'Your trading name, used on drafts and documents.'),
  ('quiet_days', '7', 'An invite or outreach with no reply for this many days has gone quiet.'),
  ('shipment_days', '5', 'A gift not marked delivered this many days after it was sent is flagged.'),
  ('metrics_days', '3', 'A post with no numbers captured this many days after it went up is flagged.'),
  ('rights_warning_days', '30', 'Usage rights ending within this many days are flagged while content is still in use.'),
  ('disclosure_labels', '#ad,ad,advertisement,sponsored,paid partnership', 'Labels accepted as identifying a post as an ad. Gifted posts need one too (ASA NZ guidance; AANA case 0323-21).')
on conflict (key) do nothing;

insert into brands (code, name, category, market, currency, contact_name, contact_email) values
  ('TF', 'Tide & Fern Skincare', 'cosmetic', 'NZ', 'NZD', 'Lucy Fraser', 'lucy@tideandfern.example'),
  ('SR', 'Southern Roast Coffee', 'food', 'NZ', 'NZD', 'Matt Hohaia', 'matt@southernroast.example'),
  ('KV', 'Kowhai Vitamins', 'therapeutic', 'AU', 'AUD', 'Dana Reid', 'dana@kowhaivitamins.example')
on conflict (code) do nothing;

insert into creators (code, full_name, email, city, country, niche, status, status_reason, rate_cents, gst_registered, agent_name, agent_email, postal_address, notes) values
  ('CR-01', 'Aroha Ngata', 'aroha@arohaglows.example', 'Auckland', 'NZ', 'skincare', 'active', null, 90000, true, null, null, '14 Kauri Road, Grey Lynn, Auckland 1021', 'Fast, reliable, films on location.'),
  ('CR-02', 'Mia Thompson', 'mia@miamakesmornings.example', 'Wellington', 'NZ', 'lifestyle', 'active', null, 150000, true, 'Jo Hart', 'jo@hartmgmt.example', '8 Aro Street, Wellington 6021', null),
  ('CR-03', 'Jack Pereira', 'jack@jackbrews.example', 'Christchurch', 'NZ', 'coffee', 'active', null, 40000, false, null, null, '3/22 Colombo Street, Christchurch 8011', null),
  ('CR-04', 'Sophie Lau', 'sophie@sophielau.example', 'Auckland', 'NZ', 'beauty', 'active', null, 350000, true, 'Jo Hart', 'jo@hartmgmt.example', '201 Ponsonby Road, Auckland 1011', 'YouTube long form. Needs ten working days for a draft.'),
  ('CR-05', 'Ella Brooks', 'ella@ellabrooksfit.example', 'Brisbane', 'AU', 'wellness', 'active', null, 120000, true, null, null, '7 Latrobe Terrace, Paddington QLD 4064', null),
  ('CR-06', 'Liam O''Connor', 'liam@liamonthego.example', 'Queenstown', 'NZ', 'travel', 'prospect', null, null, false, null, null, null, null),
  ('CR-07', 'Hana Kim', 'hana@hanaskinlab.example', 'Auckland', 'NZ', 'skincare', 'contacted', null, null, false, null, null, null, 'Small account, very high saves on routine posts.'),
  ('CR-08', 'Tom Wiremu', 'tom@tomcooksnz.example', 'Tauranga', 'NZ', 'food', 'active', null, 60000, false, null, null, '55 Devonport Road, Tauranga 3110', null),
  ('CR-09', 'Grace Patel', 'grace@gracepatelwellness.example', 'Melbourne', 'AU', 'wellness', 'active', null, 100000, true, null, null, '12 Smith Street, Fitzroy VIC 3065', null),
  ('CR-10', 'Zoe Martin', 'zoe@zoeandthecity.example', 'Auckland', 'NZ', 'lifestyle', 'paused', 'On parental leave until March.', 180000, true, null, null, null, null),
  ('CR-11', 'Ruby Chen', 'ruby@rubychenbeauty.example', 'Hamilton', 'NZ', 'beauty', 'do_not_use', 'Took the product and never posted, twice.', 50000, false, null, null, null, null),
  ('CR-12', 'Sam Fale', 'sam@samfaleeats.example', 'Auckland', 'NZ', 'food', 'prospect', null, null, false, null, null, null, null)
on conflict (code) do nothing;

insert into creator_handles (creator_id, platform, handle, followers, engagement_rate, followers_checked_on)
select c.id, x.platform, x.handle, x.followers, x.er, biz_today() - x.checked
from (values
  ('CR-01', 'instagram', '@aroha.glows', 48200, 4.10, 14),
  ('CR-01', 'tiktok', '@aroha.glows', 21500, 6.30, 14),
  ('CR-02', 'tiktok', '@miamakesmornings', 126000, 5.20, 20),
  ('CR-02', 'instagram', '@miamakesmornings', 39000, 2.80, 20),
  ('CR-03', 'instagram', '@jackbrews', 22400, 3.60, 30),
  ('CR-04', 'youtube', '@sophielau', 210000, 3.10, 10),
  ('CR-04', 'instagram', '@sophielau', 95000, 2.20, 10),
  ('CR-05', 'instagram', '@ellabrooksfit', 64000, 3.90, 25),
  ('CR-06', 'tiktok', '@liamonthego', 15800, 7.40, 40),
  ('CR-07', 'instagram', '@hanaskinlab', 9400, 8.90, 18),
  ('CR-08', 'instagram', '@tomcooksnz', 31000, 4.40, 22),
  ('CR-09', 'instagram', '@gracepatelwellness', 41000, 3.30, 12),
  ('CR-10', 'tiktok', '@zoeandthecity', 88000, 4.80, 60),
  ('CR-11', 'instagram', '@rubychenbeauty', 12000, 2.10, 200),
  ('CR-12', 'instagram', '@samfaleeats', 7200, 6.10, 5)
) as x(creator, platform, handle, followers, er, checked)
join creators c on c.code = x.creator
on conflict do nothing;

insert into campaigns (code, brand_id, name, kind, status, starts_on, ends_on, budget_cents, brief, disclosure_label, hashtag, discount_prefix, owner)
select x.code, b.id, x.name, x.kind, x.status, biz_today() + x.starts, biz_today() + x.ends, x.budget, x.brief, x.label, x.hashtag, x.prefix, x.owner
from (values
  ('CP-01', 'TF', 'Summer SPF Launch', 'paid', 'live', -20, 25, 1200000, 'Show the SPF 50 tint in a real morning routine, outdoors. Mention it is reef-safe. No before and after claims.', '#ad', '#TideAndFernSPF', 'SPF', 'Kate'),
  ('CP-02', 'SR', 'Cold Brew Gifting', 'gifting', 'live', -30, 10, 250000, 'We send the cold brew bundle. Post it if you love it, one feed post or reel, tag @southernroast.', '#ad', '#ColdBrewSummer', 'BREW', 'Kate'),
  ('CP-03', 'KV', 'Winter Immunity', 'paid', 'live', -10, 40, 800000, 'Endorse the Winter Defence range: what is in it and why you keep it in the kitchen. No personal health results, no before and after.', '#ad', '#KowhaiWinter', 'KOWHAI', 'Rangi'),
  ('CP-04', 'TF', 'Spring Glow', 'paid', 'wrapped', -120, -70, 900000, 'The Glow serum in an evening routine.', '#ad', '#TideAndFernGlow', 'GLOW', 'Kate'),
  ('CP-05', 'SR', 'Flat White Week', 'paid', 'planned', 14, 21, 300000, 'One reel making a flat white at home with the Southern blend.', '#ad', '#FlatWhiteWeek', 'FLAT', 'Rangi')
) as x(code, brand, name, kind, status, starts, ends, budget, brief, label, hashtag, prefix, owner)
join brands b on b.code = x.brand
on conflict (code) do nothing;

insert into collaborations (code, campaign_id, creator_id, stage, invited_at, responded_at, fee_cents, fee_due_days, agreement_signed_on, agreement_ref,
  usage_rights_until, usage_rights_scope, whitelisting, exclusivity_until, exclusivity_note, discount_code, stage_reason)
select x.code, cp.id, c.id, x.stage, now() - make_interval(days => x.invited), case when x.responded is null then null else now() - make_interval(days => x.responded) end,
       x.fee, 14, case when x.signed is null then null else biz_today() - x.signed end, x.ref,
       case when x.rights is null then null else biz_today() + x.rights end, x.scope, x.wl,
       case when x.excl is null then null else biz_today() + x.excl end, x.excl_note, x.dcode, x.reason
from (values
  ('K-1001', 'CP-01', 'CR-01', 'accepted', 24, 23, 90000, 22, 'HC-2026-041', 60, 'organic and paid social, NZ', true, 30, 'No other sunscreen brand until the date', 'SPF-AROHA', null),
  ('K-1002', 'CP-01', 'CR-04', 'accepted', 24, 21, 350000, 19, 'HC-2026-042', 90, 'organic social and website, NZ', false, null, null, 'SPF-SOPHIE', null),
  ('K-1003', 'CP-01', 'CR-02', 'accepted', 22, 20, 150000, null, null, null, null, false, null, null, 'SPF-MIA', null),
  ('K-1004', 'CP-02', 'CR-03', 'complete', 32, 31, 0, 30, 'HC-2026-038', null, null, false, null, null, 'BREW-JACK', null),
  ('K-1005', 'CP-02', 'CR-08', 'accepted', 28, 27, 0, null, null, null, null, false, null, null, 'BREW-TOM', null),
  ('K-1006', 'CP-02', 'CR-02', 'accepted', 10, 9, 0, 9, 'HC-2026-047', null, null, false, null, null, 'BREW-MIA', null),
  ('K-1007', 'CP-03', 'CR-05', 'accepted', 12, 11, 120000, 10, 'HC-2026-044', 120, 'organic social, AU', false, null, null, 'KOWHAI-ELLA', null),
  ('K-1008', 'CP-03', 'CR-09', 'accepted', 12, 11, 100000, 10, 'HC-2026-045', 120, 'organic social, AU', false, null, null, 'KOWHAI-GRACE', null),
  ('K-1009', 'CP-04', 'CR-01', 'complete', 125, 124, 80000, 122, 'HC-2026-019', -5, 'organic and paid social, NZ', true, null, null, 'GLOW-AROHA', null),
  ('K-1010', 'CP-04', 'CR-04', 'complete', 125, 123, 320000, 121, 'HC-2026-020', 12, 'organic and paid social, NZ', true, null, null, 'GLOW-SOPHIE', null),
  ('K-1011', 'CP-04', 'CR-11', 'cancelled', 125, 124, 50000, 122, 'HC-2026-021', null, null, false, null, null, 'GLOW-RUBY', 'Product sent, nothing posted after three reminders.'),
  ('K-1012', 'CP-01', 'CR-06', 'invited', 9, null, 70000, null, null, null, null, false, null, null, null, null),
  ('K-1013', 'CP-05', 'CR-08', 'invited', 2, null, 60000, null, null, null, null, false, null, null, null, null)
) as x(code, campaign, creator, stage, invited, responded, fee, signed, ref, rights, scope, wl, excl, excl_note, dcode, reason)
join campaigns cp on cp.code = x.campaign
join creators c on c.code = x.creator
on conflict (code) do nothing;

insert into gifts (code, collaboration_id, product, value_cents, sent_on, courier, tracking, delivered_on)
select x.code, k.id, x.product, x.value, biz_today() - x.sent, x.courier, x.tracking, case when x.delivered is null then null else biz_today() - x.delivered end
from (values
  ('G-301', 'K-1004', 'Cold brew bundle (4 x 1 L)', 6500, 25, 'NZ Post', 'NZ00412233', 22),
  ('G-302', 'K-1005', 'Cold brew bundle (4 x 1 L)', 6500, 20, 'NZ Post', 'NZ00412871', 18),
  ('G-303', 'K-1006', 'Cold brew bundle (4 x 1 L)', 6500, 6, 'NZ Post', 'NZ00413502', null),
  ('G-304', 'K-1001', 'SPF 50 tint full kit', 12000, 18, 'CourierPost', 'CP7781004', 16),
  ('G-305', 'K-1007', 'Winter Defence range', 7000, 8, 'Australia Post', 'AP33410977', 6),
  ('G-306', 'K-1008', 'Winter Defence range', 7000, 8, 'Australia Post', 'AP33410978', 6),
  ('G-307', 'K-1011', 'Glow serum kit', 9500, 118, 'CourierPost', 'CP7700121', 116),
  ('G-308', 'K-1002', 'SPF 50 tint full kit', 12000, 18, 'CourierPost', 'CP7781005', 17)
) as x(code, collab, product, value, sent, courier, tracking, delivered)
join collaborations k on k.code = x.collab
on conflict (code) do nothing;

insert into deliverables (code, collaboration_id, kind, platform, due_on, draft_received_on, draft_note, approved_on, approved_by, posted_on, post_url,
  disclosure_label, label_upfront, is_testimonial, ad_running, ad_running_since)
select x.code, k.id, x.kind, x.platform, biz_today() + x.due,
       case when x.draft is null then null else biz_today() - x.draft end, x.note,
       case when x.approved is null then null else biz_today() - x.approved end, x.approver,
       case when x.posted is null then null else biz_today() - x.posted end, x.url,
       x.label, x.upfront, x.testimonial, x.running, case when x.running_since is null then null else biz_today() - x.running_since end
from (values
  ('P-2001', 'K-1001', 'reel', 'instagram', -8, 12, 'Beach walk, tint on, reef-safe line in the voiceover.', 10, 'Lucy Fraser', 7, 'https://www.instagram.com/reel/demo-aroha-spf', '#ad', true, false, true, 5),
  ('P-2002', 'K-1001', 'story', 'instagram', -7, null, null, null, null, 7, 'https://www.instagram.com/stories/demo-aroha-spf', 'Ad', true, false, false, null),
  ('P-2003', 'K-1002', 'video', 'youtube', 5, 1, 'Ten minute summer routine, SPF segment at 3:40.', null, null, null, null, null, null, false, false, null),
  ('P-2004', 'K-1003', 'tiktok', 'tiktok', -3, null, null, null, null, null, null, null, null, false, false, null),
  ('P-2005', 'K-1004', 'post', 'instagram', -15, null, null, null, null, 16, 'https://www.instagram.com/p/demo-jack-coldbrew', '#ad', false, false, false, null),
  ('P-2006', 'K-1005', 'post', 'instagram', -4, null, null, null, null, null, null, null, null, false, false, null),
  ('P-2007', 'K-1006', 'tiktok', 'tiktok', 8, null, null, null, null, null, null, null, null, false, false, null),
  ('P-2008', 'K-1007', 'reel', 'instagram', 6, 2, 'Talks about how she has not had a cold since starting the range.', null, null, null, null, null, null, true, false, null),
  ('P-2009', 'K-1008', 'reel', 'instagram', -3, 7, 'Kitchen shelf, what is in the range, her winter routine.', 6, 'Dana Reid', 4, 'https://www.instagram.com/reel/demo-grace-kowhai', '#ad', true, true, false, null),
  ('P-2010', 'K-1009', 'reel', 'instagram', -95, 100, null, 98, 'Lucy Fraser', 95, 'https://www.instagram.com/reel/demo-aroha-glow', '#ad', true, false, true, 90),
  ('P-2011', 'K-1010', 'video', 'youtube', -90, 97, null, 94, 'Lucy Fraser', 90, 'https://www.youtube.com/watch?v=demo-sophie-glow', 'Paid partnership', true, false, false, null),
  ('P-2012', 'K-1011', 'post', 'instagram', -100, null, null, null, null, null, null, null, null, false, false, null)
) as x(code, collab, kind, platform, due, draft, note, approved, approver, posted, url, label, upfront, testimonial, running, running_since)
join collaborations k on k.code = x.collab
on conflict (code) do nothing;

insert into payments (collaboration_id, amount_cents, due_on, invoice_ref, paid_on, method)
select k.id, x.amount, biz_today() + x.due, x.ref, case when x.paid is null then null else biz_today() - x.paid end, x.method
from (values
  ('K-1001', 90000, -2, 'INV-AN-118', null::int, null),
  ('K-1009', 80000, -81, 'INV-AN-097', 80, 'bank transfer'),
  ('K-1010', 320000, -76, 'HART-2210', 75, 'bank transfer'),
  ('K-1008', 50000, -10, 'GP-0031', 10, 'bank transfer')
) as x(collab, amount, due, ref, paid, method)
join collaborations k on k.code = x.collab
where not exists (select 1 from settings where key = 'demo_seeded');

insert into post_metrics (deliverable_id, captured_on, views, reach, likes, comments, shares, saves, link_clicks, code_uses, sales_cents, source)
select d.id, biz_today() - x.captured, x.views, x.reach, x.likes, x.comments, x.shares, x.saves, x.clicks, x.codes, x.sales, x.source
from (values
  ('P-2001', 5, 38200, 29000, 2400, 130, 190, 510, 640, 41, 328000, 'creator insights screenshot'),
  ('P-2001', 1, 61400, 44800, 3900, 212, 340, 880, 1120, 74, 592000, 'creator insights screenshot'),
  ('P-2005', 9, 9800, 7600, 610, 44, 18, 95, 120, 11, 41800, 'creator insights screenshot'),
  ('P-2009', 1, 22000, 17100, 1250, 88, 60, 300, 410, 30, 189000, 'creator insights screenshot'),
  ('P-2010', 60, 72500, 51000, 4100, 260, 410, 990, 1350, 88, 704000, 'creator insights export'),
  ('P-2011', 60, 148000, 121000, 6800, 540, 300, 1200, 2900, 131, 1179000, 'YouTube Studio export')
) as x(deliverable, captured, views, reach, likes, comments, shares, saves, clicks, codes, sales, source)
join deliverables d on d.code = x.deliverable
where not exists (select 1 from settings where key = 'demo_seeded');

insert into activities (creator_id, collaboration_id, kind, direction, body, at, by_name)
select c.id, k.id, x.kind, x.dir, x.body, now() - make_interval(days => x.ago, hours => x.hrs), x.by
from (values
  ('CR-01', 'K-1001', 'email', 'out', 'Brief and terms for Summer SPF sent.', 24, 2, 'Kate'),
  ('CR-01', 'K-1001', 'email', 'in', 'Signed and back. Shooting this weekend.', 22, 5, null),
  ('CR-01', 'K-1001', 'email', 'in', 'Invoice INV-AN-118 attached for the reel and story.', 7, 3, null),
  ('CR-04', 'K-1002', 'email', 'out', 'Brief and terms sent to Jo Hart.', 24, 1, 'Kate'),
  ('CR-04', 'K-1002', 'email', 'in', 'Draft link for review.', 1, 4, null),
  ('CR-02', 'K-1003', 'dm', 'out', 'Invite for Summer SPF, fee $1,500 for one TikTok.', 22, 3, 'Kate'),
  ('CR-02', 'K-1003', 'dm', 'in', 'Yes please, send the details.', 20, 6, null),
  ('CR-02', 'K-1003', 'email', 'out', 'Brief sent to Jo, terms to follow.', 19, 2, 'Kate'),
  ('CR-03', 'K-1004', 'dm', 'out', 'Would you like to try the cold brew bundle?', 32, 2, 'Kate'),
  ('CR-03', 'K-1004', 'dm', 'in', 'Love to.', 31, 8, null),
  ('CR-08', 'K-1005', 'dm', 'out', 'Cold brew on its way.', 20, 1, 'Kate'),
  ('CR-08', 'K-1005', 'dm', 'in', 'Arrived, thanks!', 18, 6, null),
  ('CR-02', 'K-1006', 'dm', 'out', 'Cold brew bundle on its way to the Aro Street address.', 6, 2, 'Kate'),
  ('CR-05', 'K-1007', 'email', 'in', 'Draft reel attached.', 2, 7, null),
  ('CR-09', 'K-1008', 'email', 'in', 'Live now, link attached.', 4, 3, null),
  ('CR-06', 'K-1012', 'email', 'out', 'Invite for Summer SPF, one TikTok, $700.', 9, 2, 'Kate'),
  ('CR-07', null, 'dm', 'out', 'Hi Hana, we love your routine posts. Would you be open to working with Tide & Fern?', 12, 3, 'Kate'),
  ('CR-08', 'K-1013', 'email', 'out', 'Invite for Flat White Week, one reel, $600.', 2, 2, 'Rangi'),
  ('CR-11', 'K-1011', 'email', 'out', 'Third reminder about the Spring Glow post.', 88, 2, 'Kate'),
  ('CR-10', null, 'note', 'internal', 'On parental leave until March. Ask again in February.', 60, 0, 'Kate'),
  ('CR-12', null, 'note', 'internal', 'Found through #aucklandeats. Strong saves for size.', 3, 0, 'Rangi')
) as x(creator, collab, kind, dir, body, ago, hrs, by)
join creators c on c.code = x.creator
left join collaborations k on k.code = x.collab
where not exists (select 1 from settings where key = 'demo_seeded');

insert into settings (key, value, note) values ('demo_seeded', 'yes', 'The demo history has loaded. Delete this row to load it again.')
on conflict (key) do nothing;
