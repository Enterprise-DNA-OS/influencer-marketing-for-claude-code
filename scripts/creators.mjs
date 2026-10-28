#!/usr/bin/env node
// influencer-marketing-for-claude-code: the one CLI. The slash commands call this; so can you.
//
//   node scripts/creators.mjs <command> [args] [--flags] [--json]
//   npm run creators -- <command> ...
//
// Run with no arguments (or `help`) for the command list.
//
// This records what a creator programme runs on: brands, creators and their handles, campaigns and
// budgets, each collaboration (fee, signed agreement, usage rights, discount code), the product sent
// out as gifts, every deliverable from draft to posted with its ad label, the numbers each post
// earned, and the fees owed and paid. It sends nothing and pays nothing: outreach, briefs and
// chasers are drafted to drafts/, a person sends them, and the money moves in your own bank.
// Finding new creators on the social networks stays with the networks; add the ones you find here.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money, heading, truncate } from './lib/format.mjs';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest', 'blog', 'other'];
const KINDS = ['post', 'reel', 'story', 'tiktok', 'video', 'short', 'ugc_asset', 'blog', 'live'];
const CREATOR_STATUSES = ['prospect', 'contacted', 'active', 'paused', 'do_not_use'];
const CAMPAIGN_KINDS = ['paid', 'gifting', 'affiliate', 'ugc', 'ambassador'];
const BRAND_CATEGORIES = ['general', 'cosmetic', 'food', 'alcohol', 'therapeutic', 'financial'];
const LIVE_STAGES = ['accepted', 'complete'];

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'yes', 'in', 'end', 'whitelisting', 'past']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const n = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));
const cur = (cents, currency) => (cents === null || cents === undefined ? '' : money(cents, currency || 'NZD'));
const int = (v) => n(v).toLocaleString('en-NZ');

let db;
let JSON_OUT = false;
let SETTINGS = {};
let TODAY = '';

function addDays(isoDay, k) {
  const [y, m, d] = String(isoDay).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const t = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}
function iso(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s === 'today') return TODAY;
  if (s === 'yesterday') return addDays(TODAY, -1);
  if (s === 'tomorrow') return addDays(TODAY, 1);
  const rel = s.match(/^([+-])(\d+)d?$/);
  if (rel) return addDays(TODAY, (rel[1] === '-' ? -1 : 1) * Number(rel[2]));
  // NZ and AU exports write DD/MM/YYYY.
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD, today, tomorrow or +14.`);
}

function parseMoney(v, what = 'amount') {
  if (v === undefined || v === null || v === true || v === '') return null;
  const s = String(v).replace(/[$,\s]/g, '').replace(/^(nzd|aud|usd)/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new CliError(`${what} "${v}" is not a dollar amount.`);
  return Math.round(Number(s) * 100);
}

function parseCount(v, what) {
  if (v === undefined || v === null || v === true || v === '') return null;
  const s = String(v).trim().toLowerCase().replace(/,/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!m) throw new CliError(`${what} "${v}" is not a number.`);
  return Math.round(Number(m[1]) * (m[2] === 'k' ? 1000 : m[2] === 'm' ? 1_000_000 : 1));
}

function intFlag(v, dflt) {
  if (v === undefined || v === true) return dflt;
  const x = Number(v);
  if (!Number.isInteger(x) || x < 0) throw new CliError(`"${v}" is not a whole number.`);
  return x;
}

function yes(v) {
  return ['yes', 'y', 'true', '1', 'on'].includes(String(v).trim().toLowerCase());
}

function handleOf(s) {
  const h = String(s ?? '').trim().replace(/^https?:\/\/(www\.)?[a-z]+\.com\//i, '').replace(/\/.*$/, '');
  if (!h) return '';
  return h.startsWith('@') ? h : `@${h}`;
}

// 28 cents in AUD -> "A$0.28": what one engagement cost, to the cent.
const unit = (cents, currency) => (cents === null || cents === undefined ? '' : `${currency === 'AUD' ? 'A$' : currency === 'USD' ? 'US$' : '$'}${(Number(cents) / 100).toFixed(2)}`);

const out = (data, render) => { if (JSON_OUT) console.log(JSON.stringify(data, null, 2)); else render(data); };

async function nextCode(tbl, prefix, start, pad = 0) {
  const rows = await db.query(`select code from ${tbl} where code like $1`, [`${prefix}%`]);
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.code).slice(prefix.length)) || 0), start - 1);
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
}

function labels() {
  return String(SETTINGS.disclosure_labels || '#ad,ad,advertisement,sponsored,paid partnership')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}
const labelOk = (label) => !!label && labels().includes(String(label).trim().toLowerCase());

// ---------------------------------------------------------------- lookups

function ambiguous(what, rows, label) {
  return new CliError(`More than one ${what} matches. Be more specific:\n${rows.map((r) => `  ${label(r)}`).join('\n')}`);
}

async function findCreator(ref) {
  if (!ref || ref === true) throw new CliError('Which creator? Give a code (CR-04), a name, a handle or an email.');
  const r = String(ref).trim();
  const code = /^\d+$/.test(r) ? `CR-${r.padStart(2, '0')}` : r;
  const rows = await db.query(`select distinct c.* from creators c left join creator_handles h on h.creator_id = c.id
     where lower(c.code) = lower($1) or lower(c.full_name) = lower($1) or c.full_name ilike $2 or lower(coalesce(c.email, '')) = lower($1)
        or lower(h.handle) = lower($3) or h.handle ilike $2 or lower(coalesce(c.external_ref, '')) = lower($1)
     order by c.full_name`, [code, `%${r}%`, handleOf(r)]);
  const exact = rows.filter((x) => x.code.toLowerCase() === code.toLowerCase() || x.full_name.toLowerCase() === r.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No creator matches "${r}". Run: creators creators --all`);
  throw ambiguous('creator', rows, (x) => `${x.code}  ${x.full_name} (${x.status})`);
}

async function findCampaign(ref) {
  if (!ref || ref === true) throw new CliError('Which campaign? Give a code (CP-01) or part of its name.');
  const r = String(ref).trim();
  const code = /^\d+$/.test(r) ? `CP-${r.padStart(2, '0')}` : r;
  const rows = await db.query(`select cp.*, b.code as brand_code, b.name as brand, b.category as brand_category, b.market, b.currency
     from campaigns cp join brands b on b.id = cp.brand_id where lower(cp.code) = lower($1) or cp.name ilike $2 order by cp.starts_on desc nulls last`, [code, `%${r}%`]);
  const exact = rows.filter((x) => x.code.toLowerCase() === code.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No campaign matches "${r}". Run: creators campaigns --all`);
  throw ambiguous('campaign', rows, (x) => `${x.code}  ${x.name} (${x.brand}, ${x.status})`);
}

async function findBrand(ref) {
  if (!ref || ref === true) throw new CliError('Which brand? Give its code (TF) or part of its name. Run: creators brands');
  const rows = await db.query('select * from brands where lower(code) = lower($1) or name ilike $2 order by code', [ref, `%${ref}%`]);
  const exact = rows.filter((x) => x.code.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No brand matches "${ref}". Run: creators brands`);
  throw ambiguous('brand', rows, (x) => `${x.code}  ${x.name}`);
}

// A collaboration by its code, or by a creator name when that creator has one open collaboration.
async function findCollab(ref) {
  if (!ref || ref === true) throw new CliError('Which collaboration? Give its code (K-1003) or the creator\'s name.');
  const r = String(ref).trim();
  const code = /^\d+$/.test(r) ? `K-${r}` : r;
  const exact = await db.query('select * from v_collabs where lower(code) = lower($1) or lower(coalesce(discount_code, \'\')) = lower($1)', [code]);
  if (exact.length === 1) return exact[0];
  const rows = await db.query('select * from v_collabs where creator ilike $1 or lower(coalesce(handle, \'\')) = lower($2) or lower(creator_code) = lower($3) order by invited_at desc', [`%${r}%`, handleOf(r), r]);
  const open = rows.filter((x) => ['invited', 'accepted'].includes(x.stage));
  if (rows.length === 1) return rows[0];
  if (open.length === 1) return open[0];
  if (!rows.length) throw new CliError(`No collaboration matches "${r}". Run: creators collabs --all`);
  throw ambiguous('collaboration', open.length ? open : rows, (x) => `${x.code}  ${x.creator} on ${x.campaign} (${x.stage})`);
}

async function findDeliverable(ref) {
  if (!ref || ref === true) throw new CliError('Which deliverable? Give its code (P-2004), or a collaboration code when it has one open deliverable.');
  const r = String(ref).trim();
  const code = /^\d+$/.test(r) ? `P-${r}` : r;
  const exact = await db.query('select * from v_deliverables where lower(code) = lower($1)', [code]);
  if (exact.length === 1) return exact[0];
  const k = await findCollab(r);
  const rows = await db.query('select * from v_deliverables where collab_id = $1 order by due_on', [k.id]);
  const open = rows.filter((x) => !x.posted_on);
  if (rows.length === 1) return rows[0];
  if (open.length === 1) return open[0];
  if (!rows.length) throw new CliError(`${k.code} has no deliverables. Add one: creators deliverable ${k.code} --kind=reel --due=+14`);
  throw ambiguous('deliverable', open.length ? open : rows, (x) => `${x.code}  ${x.kind} for ${x.creator}, ${x.state}`);
}

// ---------------------------------------------------------------- shared calculations

// What each live collaboration still owes the creator, and when it falls due.
// Due: the earliest unpaid invoice recorded, else fee_due_days after the last deliverable goes up.
async function owedRows() {
  const rows = await db.query(`select k.*, (select min(p.due_on) from payments p where p.collaboration_id = k.id and p.paid_on is null) as invoice_due_on,
      (select string_agg(p.invoice_ref, ', ') from payments p where p.collaboration_id = k.id and p.paid_on is null) as invoice_refs
    from v_collabs k where k.stage in ('accepted', 'complete') and k.fee_cents > k.paid_cents order by k.code`);
  return rows.map((k) => {
    const allPosted = n(k.deliverables) > 0 && n(k.posted) === n(k.deliverables);
    const due = k.invoice_due_on ? iso(k.invoice_due_on) : allPosted ? addDays(iso(k.last_posted_on), n(k.fee_due_days)) : null;
    return {
      collab: k.code, creator: k.creator, campaign: k.campaign, brand_code: k.brand_code, currency: k.currency,
      fee_cents: n(k.fee_cents), paid_cents: n(k.paid_cents), owed_cents: n(k.fee_cents) - n(k.paid_cents),
      posted: `${n(k.posted)}/${n(k.deliverables)}`, invoice: k.invoice_refs || '', due_on: due,
      days_overdue: due && due < TODAY ? daysBetween(due, TODAY) : 0,
      state: due === null ? 'not due until posted' : due < TODAY ? 'OVERDUE' : 'due',
    };
  });
}

async function complianceRows() {
  const out = [];
  const posted = await db.query('select * from v_deliverables where posted_on is not null order by posted_on');
  // 1. disclosure
  const disc = posted.filter((d) => d.collab_stage !== 'cancelled' && (!labelOk(d.disclosure_label) || d.label_upfront !== true));
  out.push({
    id: 'disclosure', rule: 'Every post a creator was paid or gifted for is labelled as an ad, upfront',
    source: 'NZ: Advertising Standards Code Rule 2(a) and the ASA influencer guidance. AU: AANA Code of Ethics s 2.7.',
    count: disc.length,
    items: disc.map((d) => ({ ref: d.code, what: `${d.creator} ${d.kind} for ${d.campaign} (${d.brand_code}): ${d.disclosure_label ? `label "${d.disclosure_label}"${d.label_upfront === true ? '' : ' not upfront'}${labelOk(d.disclosure_label) ? '' : ', not an accepted label'}` : 'no ad label'}`, fix: `ask ${d.creator} to move "${d.required_label}" to the start of the caption, then: posted ${d.code} --label="${d.required_label}"` })),
  });
  // 2. therapeutic goods testimonials (Australia)
  const tga = posted.filter((d) => d.brand_category === 'therapeutic' && String(d.market).includes('AU') && d.is_testimonial && (n(d.fee_cents) > 0 || n(d.gift_cents) > 0) && d.collab_stage !== 'cancelled');
  out.push({
    id: 'therapeutic', rule: 'No paid or gifted testimonial for therapeutic goods advertised in Australia, labelled or not',
    source: 'Therapeutic Goods (Therapeutic Goods Advertising Code) Instrument 2021 s 24(4).',
    count: tga.length,
    items: tga.map((d) => ({ ref: d.code, what: `${d.creator} ${d.kind} for ${d.brand}: a testimonial from a paid or gifted creator`, fix: `ask ${d.creator} to take it down or re-cut it as an endorsement with no personal results; once the new cut is up: posted ${d.code} --testimonial=no` })),
  });
  // 3. a signed agreement before content or product moves
  const agr = await db.query(`select k.* from v_collabs k where k.stage in ('accepted', 'complete') and k.agreement_signed_on is null
      and (k.posted > 0 or k.gift_cents > 0 or k.next_due_on < biz_today()) order by k.code`);
  out.push({
    id: 'agreement', rule: 'Every accepted collaboration has signed terms that state the ad label, before product ships or content is due',
    source: 'ASA influencer guidance: advertisers must take all practical steps to make sure ad content is identified. AANA Code s 2.7 holds the advertiser responsible.',
    count: agr.length,
    items: agr.map((k) => ({ ref: k.code, what: `${k.creator} on ${k.campaign}: ${n(k.gift_cents) ? 'product sent' : n(k.posted) ? 'content posted' : 'content due'} with no signed terms`, fix: `send the brief and terms (/draft-brief ${k.code}), then: agreement ${k.code} --signed=today` })),
  });
  // 4. content reused inside its usage rights
  const rights = posted.filter((d) => d.ad_running && (!d.usage_rights_until || iso(d.usage_rights_until) < TODAY));
  out.push({
    id: 'rights', rule: 'Creator content runs as an ad only inside the usage rights the creator granted',
    source: 'The creator owns the copyright unless the agreement says otherwise: Copyright Act 1994 (NZ) ss 16 and 29; Copyright Act 1968 (Cth) ss 36 and 101.',
    count: rights.length,
    items: rights.map((d) => ({ ref: d.code, what: `${d.creator} ${d.kind} for ${d.brand} running as an ad ${d.usage_rights_until ? `${daysBetween(iso(d.usage_rights_until), TODAY)} days past its rights (ended ${iso(d.usage_rights_until)})` : 'with no usage rights recorded'}`, fix: `pause the ad today, then: ad ${d.code} off; or agree an extension and: agreement ${d.collab_code} --rights-until=<date>` })),
  });
  return out;
}

// ---------------------------------------------------------------- reads

async function cmdStats() {
  const [s] = await db.query(`select
      (select count(*) from creators where status = 'active') as active_creators,
      (select count(*) from creators) as creators,
      (select count(*) from campaigns where status = 'live') as live_campaigns,
      (select count(*) from collaborations where stage = 'accepted') as open_collabs,
      (select count(*) from collaborations where stage = 'invited') as invites_out,
      (select count(*) from v_deliverables where state = 'overdue' and collab_stage in ('accepted', 'complete')) as content_overdue,
      (select count(*) from v_deliverables where state = 'awaiting approval' and collab_stage in ('accepted', 'complete')) as awaiting_approval,
      (select count(*) from v_deliverables where posted_on >= biz_today() - 30) as posted_30_days`);
  const owed = await owedRows();
  const comp = await complianceRows();
  const res = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, n(v)]));
  res.fees_overdue = owed.filter((o) => o.state === 'OVERDUE').length;
  res.compliance_breaches = comp.reduce((a, c) => a + c.count, 0);
  out(res, (r) => {
    console.log(heading(SETTINGS.business_name || 'Creator programme'));
    for (const [k, v] of Object.entries(r)) console.log(`  ${k.replace(/_/g, ' ').padEnd(22)} ${v}`);
  });
}

async function cmdCreators(flags) {
  const where = [];
  const params = [];
  if (!flags.all) where.push(`p.status <> 'do_not_use'`);
  if (flags.status) { params.push(flags.status); where.push(`p.status = $${params.length}`); }
  if (flags.niche) { params.push(`%${flags.niche}%`); where.push(`c.niche ilike $${params.length}`); }
  if (flags.platform) { params.push(flags.platform); where.push(`exists (select 1 from creator_handles h where h.creator_id = c.id and h.platform = $${params.length})`); }
  if (flags.country) { params.push(String(flags.country).toUpperCase()); where.push(`c.country = $${params.length}`); }
  const rows = await db.query(`select p.code, p.creator, p.status, c.niche, c.country, p.platform, p.handle, p.followers, p.engagement_rate, c.rate_cents,
      p.collabs, p.posted, p.posted_late, p.last_contact_at
    from v_creator_performance p join creators c on c.id = p.id ${where.length ? 'where ' + where.join(' and ') : ''}
    order by case p.status when 'active' then 0 when 'contacted' then 1 when 'prospect' then 2 when 'paused' then 3 else 4 end, p.followers desc nulls last`, params);
  out(rows.map((r) => ({ ...r, followers: n(r.followers), engagement_rate: r.engagement_rate === null ? null : Number(r.engagement_rate), collabs: n(r.collabs), posted: n(r.posted), posted_late: n(r.posted_late) })), (rs) => {
    console.log(table(rs, [
      { key: 'code', label: 'Code' }, { key: 'creator', label: 'Creator' }, { key: 'handle', label: 'Main handle' }, { key: 'platform', label: 'On' },
      { key: 'followers', label: 'Followers', format: int, align: 'right' }, { key: 'engagement_rate', label: 'Eng %', align: 'right' },
      { key: 'niche', label: 'Niche' }, { key: 'status', label: 'Status' }, { key: 'rate_cents', label: 'Rate', format: (v) => cur(v), align: 'right' },
      { key: 'posted', label: 'Posts', align: 'right' }, { key: 'posted_late', label: 'Late', align: 'right' },
    ]));
  });
}

async function cmdCreator(ref) {
  const c = await findCreator(ref);
  const handles = await db.query('select platform, handle, followers, engagement_rate, followers_checked_on from creator_handles where creator_id = $1 order by followers desc nulls last', [c.id]);
  const collabs = await db.query('select code, campaign, brand_code, stage, fee_cents, currency, gift_cents, posted, deliverables, views, engagements, code_uses, sales_cents, usage_rights_until, discount_code from v_collabs where creator_id = $1 order by invited_at desc', [c.id]);
  const acts = await db.query(`select a.at, a.kind, a.direction, a.body, a.by_name, k.code as collab from activities a left join collaborations k on k.id = a.collaboration_id
    where a.creator_id = $1 order by a.at desc limit 15`, [c.id]);
  const [perf] = await db.query('select cost_cents, views, engagements, code_uses, sales_cents, posted, posted_late from v_creator_performance where id = $1', [c.id]);
  const card = {
    code: c.code, name: c.full_name, status: c.status, status_reason: c.status_reason, email: c.email, mobile: c.mobile, city: c.city, country: c.country,
    niche: c.niche, rate_cents: c.rate_cents, gst_registered: c.gst_registered, agent: c.agent_name ? `${c.agent_name} <${c.agent_email || ''}>` : null,
    postal_address: c.postal_address, notes: c.notes,
    handles: handles.map((h) => ({ ...h, followers: n(h.followers), engagement_rate: h.engagement_rate === null ? null : Number(h.engagement_rate) })),
    collaborations: collabs.map((k) => ({ ...k, fee_cents: n(k.fee_cents), gift_cents: n(k.gift_cents), posted: n(k.posted), deliverables: n(k.deliverables), views: n(k.views), engagements: n(k.engagements), code_uses: n(k.code_uses), sales_cents: n(k.sales_cents) })),
    totals: Object.fromEntries(Object.entries(perf).map(([k, v]) => [k, n(v)])),
    activity: acts,
  };
  out(card, (x) => {
    console.log(heading(`${x.code}  ${x.name}  (${x.status}${x.status_reason ? ': ' + x.status_reason : ''})`));
    console.log(`  ${[x.email, x.mobile, [x.city, x.country].filter(Boolean).join(', '), x.niche].filter(Boolean).join('  |  ')}`);
    if (x.agent) console.log(`  Agent: ${x.agent}`);
    if (x.rate_cents) console.log(`  Usual rate: ${cur(x.rate_cents)}${x.gst_registered ? ' plus GST' : ''}`);
    if (x.notes) console.log(`  Notes: ${x.notes}`);
    console.log('\n' + table(x.handles, [{ key: 'platform', label: 'Platform' }, { key: 'handle', label: 'Handle' }, { key: 'followers', label: 'Followers', format: int, align: 'right' }, { key: 'engagement_rate', label: 'Eng %', align: 'right' }, { key: 'followers_checked_on', label: 'Checked', format: iso }]));
    if (x.collaborations.length) {
      console.log('\nCollaborations');
      console.log(table(x.collaborations, [{ key: 'code', label: 'Code' }, { key: 'campaign', label: 'Campaign' }, { key: 'stage', label: 'Stage' }, { key: 'fee_cents', label: 'Fee', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'posted', label: 'Posted', format: (v, r) => `${v}/${r.deliverables}` }, { key: 'engagements', label: 'Engagements', format: int, align: 'right' }, { key: 'code_uses', label: 'Code uses', align: 'right' }, { key: 'sales_cents', label: 'Sales', format: (v, r) => cur(v, r.currency), align: 'right' }]));
    }
    if (x.activity.length) {
      console.log('\nLatest contact');
      for (const a of x.activity) console.log(`  ${iso(a.at)}  ${a.kind.padEnd(5)} ${a.direction.padEnd(8)} ${truncate(a.body, 80)}${a.collab ? '  [' + a.collab + ']' : ''}`);
    }
  });
}

async function cmdBrands() {
  const rows = await db.query(`select b.code, b.name, b.category, b.market, b.currency, b.contact_name,
      (select count(*) from campaigns cp where cp.brand_id = b.id and cp.status = 'live') as live_campaigns from brands b order by b.code`);
  out(rows.map((r) => ({ ...r, live_campaigns: n(r.live_campaigns) })), (rs) => console.log(table(rs, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Brand' }, { key: 'category', label: 'Category' }, { key: 'market', label: 'Market' },
    { key: 'currency', label: 'Currency' }, { key: 'contact_name', label: 'Contact' }, { key: 'live_campaigns', label: 'Live', align: 'right' },
  ])));
}

async function cmdCampaigns(flags) {
  const rows = await db.query(`select * from v_campaign_results ${flags.all ? '' : `where status in ('planned', 'live')`} order by case status when 'live' then 0 when 'planned' then 1 else 2 end, starts_on desc nulls last`);
  const res = rows.map((r) => {
    const committed = n(r.fees_cents) + n(r.gifts_cents);
    return {
      code: r.code, name: r.name, brand_code: r.brand_code, kind: r.kind, status: r.status, starts_on: iso(r.starts_on), ends_on: iso(r.ends_on), owner: r.owner, currency: r.currency,
      budget_cents: n(r.budget_cents), committed_cents: committed, left_cents: n(r.budget_cents) - committed, creators: n(r.creators), invited: n(r.invited),
      posted: `${n(r.posted)}/${n(r.deliverables)}`, engagements: n(r.engagements), code_uses: n(r.code_uses), sales_cents: n(r.sales_cents),
    };
  });
  out(res, (rs) => console.log(table(rs, [
    { key: 'code', label: 'Code' }, { key: 'name', label: 'Campaign' }, { key: 'brand_code', label: 'Brand' }, { key: 'kind', label: 'Kind' }, { key: 'status', label: 'Status' },
    { key: 'ends_on', label: 'Ends' }, { key: 'budget_cents', label: 'Budget', format: (v, r) => cur(v, r.currency), align: 'right' },
    { key: 'committed_cents', label: 'Committed', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'creators', label: 'Creators', align: 'right' },
    { key: 'posted', label: 'Posted' }, { key: 'sales_cents', label: 'Sales', format: (v, r) => cur(v, r.currency), align: 'right' },
  ])));
}

async function cmdCampaign(ref) {
  const cp = await findCampaign(ref);
  const [r] = await db.query('select * from v_campaign_results where id = $1', [cp.id]);
  const roster = await db.query('select code, creator, handle, stage, fee_cents, gift_cents, agreement_signed_on, posted, deliverables, engagements, code_uses, sales_cents, discount_code from v_collabs where campaign_id = $1 order by code', [cp.id]);
  const dels = await db.query('select code, creator, kind, due_on, state, days_late, posted_on, disclosure_label, label_upfront, views, engagements from v_deliverables where campaign_code = $1 and collab_stage <> \'declined\' order by due_on', [cp.code]);
  const card = {
    code: cp.code, name: cp.name, brand: cp.brand, brand_category: cp.brand_category, market: cp.market, kind: cp.kind, status: cp.status,
    starts_on: iso(cp.starts_on), ends_on: iso(cp.ends_on), owner: cp.owner, brief: cp.brief, label: cp.disclosure_label, hashtag: cp.hashtag, currency: cp.currency,
    budget_cents: n(cp.budget_cents), committed_cents: n(r.fees_cents) + n(r.gifts_cents), paid_cents: n(r.paid_cents),
    roster: roster.map((k) => ({ ...k, fee_cents: n(k.fee_cents), gift_cents: n(k.gift_cents), posted: n(k.posted), deliverables: n(k.deliverables), engagements: n(k.engagements), code_uses: n(k.code_uses), sales_cents: n(k.sales_cents), agreement_signed_on: iso(k.agreement_signed_on) || null })),
    deliverables: dels.map((d) => ({ ...d, due_on: iso(d.due_on), posted_on: iso(d.posted_on) || null, days_late: d.state === 'overdue' ? n(d.days_late) : 0, views: d.views === null ? null : n(d.views), engagements: d.engagements === null ? null : n(d.engagements) })),
  };
  out(card, (x) => {
    console.log(heading(`${x.code}  ${x.name}  (${x.brand}, ${x.kind}, ${x.status})`));
    console.log(`  ${x.starts_on} to ${x.ends_on}  |  owner ${x.owner || '-'}  |  label "${x.label}"${x.hashtag ? '  |  ' + x.hashtag : ''}`);
    console.log(`  Budget ${cur(x.budget_cents, x.currency)}, committed ${cur(x.committed_cents, x.currency)}, paid ${cur(x.paid_cents, x.currency)}`);
    if (x.brand_category === 'therapeutic' && String(x.market).includes('AU')) console.log('  Therapeutic goods in Australia: no testimonials from paid or gifted creators (TGA Advertising Code s 24(4)).');
    if (x.brief) console.log(`  Brief: ${x.brief}`);
    console.log('\nCreators');
    console.log(table(x.roster, [{ key: 'code', label: 'Code' }, { key: 'creator', label: 'Creator' }, { key: 'handle', label: 'Handle' }, { key: 'stage', label: 'Stage' }, { key: 'fee_cents', label: 'Fee', format: (v) => cur(v, x.currency), align: 'right' }, { key: 'agreement_signed_on', label: 'Signed', format: (v) => v || 'NO' }, { key: 'posted', label: 'Posted', format: (v, r) => `${v}/${r.deliverables}` }, { key: 'sales_cents', label: 'Sales', format: (v) => cur(v, x.currency), align: 'right' }]));
    console.log('\nDeliverables');
    console.log(table(x.deliverables, [{ key: 'code', label: 'Code' }, { key: 'creator', label: 'Creator' }, { key: 'kind', label: 'Kind' }, { key: 'due_on', label: 'Due' }, { key: 'state', label: 'State', format: (v, r) => (v === 'overdue' ? `OVERDUE ${r.days_late}d` : v) }, { key: 'disclosure_label', label: 'Label', format: (v, r) => (v ? `${v}${r.label_upfront ? '' : ' (not upfront)'}` : '') }, { key: 'engagements', label: 'Engagements', format: (v) => (v === null ? '' : int(v)), align: 'right' }]));
  });
}

async function cmdCollabs(flags) {
  const where = flags.all ? '' : `where stage in ('invited', 'accepted')`;
  const rows = await db.query(`select code, campaign_code, creator, handle, stage, fee_cents, currency, agreement_signed_on, posted, deliverables, next_due_on, discount_code from v_collabs ${where} order by campaign_code, code`);
  out(rows.map((r) => ({ ...r, fee_cents: n(r.fee_cents), posted: n(r.posted), deliverables: n(r.deliverables), agreement_signed_on: iso(r.agreement_signed_on) || null, next_due_on: iso(r.next_due_on) || null })), (rs) => console.log(table(rs, [
    { key: 'code', label: 'Code' }, { key: 'campaign_code', label: 'Campaign' }, { key: 'creator', label: 'Creator' }, { key: 'stage', label: 'Stage' },
    { key: 'fee_cents', label: 'Fee', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'agreement_signed_on', label: 'Signed', format: (v) => v || '-' },
    { key: 'posted', label: 'Posted', format: (v, r) => `${v}/${r.deliverables}` }, { key: 'next_due_on', label: 'Next due', format: (v) => v || '' }, { key: 'discount_code', label: 'Code' },
  ])));
}

async function cmdDue(flags) {
  const days = intFlag(flags.days, 14);
  const rows = await db.query(`select code, collab_code, creator, handle, campaign, kind, platform, due_on, state, days_late, draft_received_on
    from v_deliverables where posted_on is null and collab_stage = 'accepted' and (due_on <= biz_today() + $1::int or draft_received_on is not null) order by due_on`, [days]);
  out(rows.map((r) => ({ ...r, due_on: iso(r.due_on), days_late: r.state === 'overdue' ? n(r.days_late) : 0, draft_received_on: iso(r.draft_received_on) || null })), (rs) => console.log(table(rs, [
    { key: 'code', label: 'Code' }, { key: 'creator', label: 'Creator' }, { key: 'campaign', label: 'Campaign' }, { key: 'kind', label: 'Kind' }, { key: 'due_on', label: 'Due' },
    { key: 'state', label: 'State', format: (v, r) => (v === 'overdue' ? `OVERDUE ${r.days_late}d` : v) },
  ])));
}

async function cmdOwed() {
  const rows = await owedRows();
  out(rows, (rs) => {
    console.log(table(rs, [
      { key: 'collab', label: 'Collab' }, { key: 'creator', label: 'Creator' }, { key: 'campaign', label: 'Campaign' },
      { key: 'owed_cents', label: 'Owed', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'posted', label: 'Posted' },
      { key: 'invoice', label: 'Invoice' }, { key: 'due_on', label: 'Due', format: (v) => v || '' }, { key: 'state', label: 'State', format: (v, r) => (v === 'OVERDUE' ? `OVERDUE ${r.days_overdue}d` : v) },
    ]));
    const by = {};
    for (const r of rs) { by[r.currency] ??= { due: 0, all: 0 }; by[r.currency].all += r.owed_cents; if (r.due_on) by[r.currency].due += r.owed_cents; }
    for (const [c, v] of Object.entries(by)) console.log(`  ${c}: ${cur(v.due, c)} due now or dated, ${cur(v.all, c)} committed in all`);
  });
}

async function cmdGifting() {
  const rows = await db.query(`select g.code, g.product, g.value_cents, g.sent_on, g.delivered_on, g.tracking, k.code as collab, k.creator, k.campaign, k.stage, k.currency, k.posted, k.deliverables
    from gifts g join v_collabs k on k.id = g.collaboration_id order by g.sent_on desc`);
  const res = rows.map((g) => ({
    code: g.code, collab: g.collab, creator: g.creator, campaign: g.campaign, product: g.product, value_cents: n(g.value_cents), currency: g.currency,
    sent_on: iso(g.sent_on), delivered_on: iso(g.delivered_on) || null, tracking: g.tracking,
    result: n(g.posted) > 0 ? 'posted' : !g.delivered_on ? `not delivered (${daysBetween(iso(g.sent_on), TODAY)}d)` : g.stage === 'cancelled' ? 'never posted (cancelled)' : `no post yet (${daysBetween(iso(g.delivered_on), TODAY)}d since delivery)`,
  }));
  const summary = { gifts: res.length, posted: res.filter((r) => r.result === 'posted').length, value_never_posted_cents: res.filter((r) => r.result !== 'posted').reduce((a, r) => a + r.value_cents, 0) };
  out({ gifts: res, summary }, (x) => {
    console.log(table(x.gifts, [{ key: 'code', label: 'Gift' }, { key: 'creator', label: 'Creator' }, { key: 'campaign', label: 'Campaign' }, { key: 'product', label: 'Product' }, { key: 'value_cents', label: 'Value', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'sent_on', label: 'Sent' }, { key: 'result', label: 'Result' }]));
    console.log(`  ${x.summary.posted} of ${x.summary.gifts} gifts turned into a post.`);
  });
}

async function cmdRights() {
  const warn = n(SETTINGS.rights_warning_days || 30);
  const rows = await db.query(`select k.code, k.creator, k.campaign, k.brand_code, k.usage_rights_until, k.whitelisting, k.agreement_signed_on,
      (select count(*) from deliverables d where d.collaboration_id = k.id and d.ad_running) as ads_running,
      (select string_agg(d.code, ', ') from deliverables d where d.collaboration_id = k.id and d.ad_running) as running
    from v_collabs k where k.stage in ('accepted', 'complete') and (k.usage_rights_until is not null or k.whitelisting or exists (select 1 from deliverables d where d.collaboration_id = k.id and d.ad_running))
    order by k.usage_rights_until nulls first`);
  const res = rows.map((r) => {
    const until = iso(r.usage_rights_until) || null;
    const left = until ? daysBetween(TODAY, until) : null;
    const running = n(r.ads_running) > 0;
    return {
      collab: r.code, creator: r.creator, campaign: r.campaign, brand_code: r.brand_code, rights_until: until, days_left: left, whitelisting: r.whitelisting, ads_running: r.running || '',
      state: running && (left === null || left < 0) ? 'BREACH: ad running past rights' : left !== null && left < 0 ? 'ended' : left !== null && left <= warn && (running || r.whitelisting) ? 'ending soon' : 'ok',
    };
  });
  out(res, (rs) => console.log(table(rs, [{ key: 'collab', label: 'Collab' }, { key: 'creator', label: 'Creator' }, { key: 'campaign', label: 'Campaign' }, { key: 'rights_until', label: 'Rights until', format: (v) => v || 'NONE' }, { key: 'days_left', label: 'Days left', align: 'right' }, { key: 'whitelisting', label: 'Whitelist', format: (v) => (v ? 'yes' : '') }, { key: 'ads_running', label: 'Running as ads' }, { key: 'state', label: 'State' }])));
}

async function cmdResults(ref) {
  const rows = ref ? [await findCampaign(ref)] : await db.query(`select code from campaigns where status in ('live', 'wrapped') order by starts_on desc`);
  const res = [];
  for (const cpRef of rows) {
    const [r] = await db.query('select * from v_campaign_results where code = $1', [cpRef.code]);
    const cost = n(r.fees_cents) + n(r.gifts_cents);
    const per = await db.query(`select code, creator, handle, stage, fee_cents, paid_cents, gift_cents, posted, views, engagements, link_clicks, code_uses, sales_cents
      from v_collabs where campaign_id = $1 and stage in ('accepted', 'complete', 'cancelled') order by sales_cents desc, engagements desc`, [r.id]);
    res.push({
      code: r.code, name: r.name, brand: r.brand, status: r.status, currency: r.currency, budget_cents: n(r.budget_cents), cost_cents: cost,
      posted: n(r.posted), views: n(r.views), engagements: n(r.engagements), link_clicks: n(r.link_clicks), code_uses: n(r.code_uses), sales_cents: n(r.sales_cents),
      cost_per_engagement_cents: n(r.engagements) ? Math.round((100 * cost) / n(r.engagements)) / 100 : null,
      sales_per_dollar: cost ? Math.round((100 * n(r.sales_cents)) / cost) / 100 : null,
      creators: per.map((k) => {
        // a cancelled deal cost what was paid and sent, not the fee that was agreed
        const c = (k.stage === 'cancelled' ? n(k.paid_cents) : n(k.fee_cents)) + n(k.gift_cents);
        return { collab: k.code, creator: k.creator, stage: k.stage, cost_cents: c, posted: n(k.posted), views: n(k.views), engagements: n(k.engagements), code_uses: n(k.code_uses), sales_cents: n(k.sales_cents), sales_per_dollar: c && n(k.posted) ? Math.round((100 * n(k.sales_cents)) / c) / 100 : null };
      }),
    });
  }
  out(ref ? res[0] : res, () => {
    for (const r of res) {
      console.log(heading(`${r.code}  ${r.name}  (${r.brand}, ${r.status})`));
      console.log(`  Cost ${cur(r.cost_cents, r.currency)} of ${cur(r.budget_cents, r.currency)}  |  ${int(r.views)} views, ${int(r.engagements)} engagements, ${int(r.code_uses)} code uses, ${cur(r.sales_cents, r.currency)} in tracked sales`);
      console.log(`  ${r.cost_per_engagement_cents === null ? 'No engagements yet' : `${unit(r.cost_per_engagement_cents, r.currency)} per engagement`}${r.sales_per_dollar === null ? '' : `  |  ${unit(Math.round(r.sales_per_dollar * 100), r.currency)} in tracked sales for every ${unit(100, r.currency).replace('.00', '')} spent`}`);
      console.log(table(r.creators, [{ key: 'creator', label: 'Creator' }, { key: 'cost_cents', label: 'Cost', format: (v) => cur(v, r.currency), align: 'right' }, { key: 'posted', label: 'Posts', align: 'right' }, { key: 'engagements', label: 'Engagements', format: int, align: 'right' }, { key: 'code_uses', label: 'Code uses', align: 'right' }, { key: 'sales_cents', label: 'Sales', format: (v) => cur(v, r.currency), align: 'right' }, { key: 'sales_per_dollar', label: 'Sales per $1', align: 'right' }]));
    }
  });
}

// Every creator who has posted, ranked on what an engagement and a sale actually cost, in each currency.
async function cmdLeaderboard(flags) {
  const by = String(flags.by || 'engagement');
  const rows = await db.query(`select k.creator_code as code, k.creator, k.handle, k.currency,
      sum(k.fee_cents + k.gift_cents) as cost_cents, sum(k.posted) as posts, sum(k.views) as views, sum(k.engagements) as engagements,
      sum(k.code_uses) as code_uses, sum(k.sales_cents) as sales_cents,
      (select count(*) from deliverables d join collaborations k2 on k2.id = d.collaboration_id where k2.creator_id = k.creator_id and d.posted_on > d.due_on) as late
    from v_collabs k where k.posted > 0 and k.stage in ('accepted', 'complete') group by k.creator_id, k.creator_code, k.creator, k.handle, k.currency`);
  const res = rows.map((r) => ({
    code: r.code, creator: r.creator, handle: r.handle, currency: r.currency, cost_cents: n(r.cost_cents), posts: n(r.posts), views: n(r.views), engagements: n(r.engagements),
    code_uses: n(r.code_uses), sales_cents: n(r.sales_cents), late_posts: n(r.late),
    cost_per_engagement_cents: n(r.engagements) ? Math.round((100 * n(r.cost_cents)) / n(r.engagements)) / 100 : null,
    sales_per_dollar: n(r.cost_cents) ? Math.round((100 * n(r.sales_cents)) / n(r.cost_cents)) / 100 : null,
  }));
  const key = by === 'sales' ? (a, b) => (b.sales_per_dollar ?? -1) - (a.sales_per_dollar ?? -1) : (a, b) => (a.cost_per_engagement_cents ?? 1e12) - (b.cost_per_engagement_cents ?? 1e12);
  res.sort((a, b) => (a.currency === b.currency ? key(a, b) : a.currency.localeCompare(b.currency) * -1));
  out(res, (rs) => {
    console.log(table(rs, [{ key: 'creator', label: 'Creator' }, { key: 'handle', label: 'Handle' }, { key: 'cost_cents', label: 'Cost', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'posts', label: 'Posts', align: 'right' }, { key: 'engagements', label: 'Engagements', format: int, align: 'right' }, { key: 'cost_per_engagement_cents', label: 'Per engagement', format: (v, r) => unit(v, r.currency), align: 'right' }, { key: 'code_uses', label: 'Code uses', align: 'right' }, { key: 'sales_per_dollar', label: 'Sales per $1', align: 'right' }, { key: 'late_posts', label: 'Late', align: 'right' }]));
  });
}

async function cmdSpend() {
  const rows = await db.query(`select b.code as brand_code, b.name as brand, b.currency, sum(r.budget_cents) as budget_cents, sum(r.fees_cents + r.gifts_cents) as committed_cents, sum(r.paid_cents) as paid_cents, sum(r.gifts_cents) as gifts_cents, sum(r.sales_cents) as sales_cents
    from v_campaign_results r join brands b on b.code = r.brand_code where r.status <> 'cancelled' group by b.code, b.name, b.currency order by b.code`);
  const res = rows.map((r) => ({ brand_code: r.brand_code, brand: r.brand, currency: r.currency, budget_cents: n(r.budget_cents), committed_cents: n(r.committed_cents), paid_cents: n(r.paid_cents), gifts_cents: n(r.gifts_cents), left_cents: n(r.budget_cents) - n(r.committed_cents), sales_cents: n(r.sales_cents) }));
  out(res, (rs) => console.log(table(rs, [{ key: 'brand', label: 'Brand' }, { key: 'budget_cents', label: 'Budget', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'committed_cents', label: 'Committed', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'paid_cents', label: 'Fees paid', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'gifts_cents', label: 'Product', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'left_cents', label: 'Left', format: (v, r) => cur(v, r.currency), align: 'right' }, { key: 'sales_cents', label: 'Tracked sales', format: (v, r) => cur(v, r.currency), align: 'right' }])));
}

// Creators worth inviting to a campaign: not already on it, not paused or barred, best engagement first,
// with what they cost per engagement last time and how often they posted late.
async function cmdShortlist(ref, flags) {
  const cp = await findCampaign(ref);
  const params = [cp.id];
  let extra = '';
  if (flags.niche) { params.push(`%${flags.niche}%`); extra += ` and c.niche ilike $${params.length}`; }
  if (flags.platform) { params.push(flags.platform); extra += ` and exists (select 1 from creator_handles h where h.creator_id = c.id and h.platform = $${params.length})`; }
  const minF = parseCount(flags['min-followers'], 'min-followers');
  if (minF) { params.push(minF); extra += ` and p.followers >= $${params.length}`; }
  // Creators whose audience is in the campaign's market.
  if (cp.market === 'AU' || cp.market === 'NZ') { params.push(cp.market); extra += ` and c.country = $${params.length}`; }
  const rows = await db.query(`select p.code, p.creator, p.status, c.niche, c.country, p.platform, p.handle, p.followers, p.engagement_rate, c.rate_cents, p.cost_cents, p.engagements, p.posted, p.posted_late
    from v_creator_performance p join creators c on c.id = p.id
    where p.status in ('active', 'prospect', 'contacted') and not exists (select 1 from collaborations k where k.campaign_id = $1 and k.creator_id = p.id) ${extra}
    order by p.engagement_rate desc nulls last, p.followers desc`, params);
  out(rows.map((r) => ({ ...r, followers: n(r.followers), engagement_rate: r.engagement_rate === null ? null : Number(r.engagement_rate), past_cost_per_engagement: n(r.engagements) ? Math.round((100 * n(r.cost_cents)) / n(r.engagements)) / 100 : null, posted: n(r.posted), posted_late: n(r.posted_late) })), (rs) => {
    console.log(heading(`Shortlist for ${cp.code} ${cp.name}`));
    console.log(table(rs, [{ key: 'code', label: 'Code' }, { key: 'creator', label: 'Creator' }, { key: 'handle', label: 'Handle' }, { key: 'followers', label: 'Followers', format: int, align: 'right' }, { key: 'engagement_rate', label: 'Eng %', align: 'right' }, { key: 'niche', label: 'Niche' }, { key: 'status', label: 'Status' }, { key: 'past_cost_per_engagement', label: 'Last per eng.', format: (v) => (v === null ? 'new' : unit(v, cp.currency)), align: 'right' }, { key: 'posted_late', label: 'Late before', align: 'right' }]));
  });
}

// Everything that needs a person, worst first.
async function cmdAttention() {
  const items = [];
  const add = (rank, area, what, action) => items.push({ rank, area, what, action });
  const comp = await complianceRows();
  for (const c of comp) for (const i of c.items) add(1, c.id, `${i.ref} ${i.what}`, i.fix);

  // A testimonial draft for therapeutic goods in Australia must not be approved as it stands.
  const tgaDrafts = await db.query(`select * from v_deliverables where state = 'awaiting approval' and is_testimonial and brand_category = 'therapeutic' and market like '%AU%' and collab_stage = 'accepted'`);
  for (const d of tgaDrafts) add(1, 'therapeutic', `${d.code} draft from ${d.creator} for ${d.brand} is a testimonial: it cannot be approved for Australia`, `ask ${d.creator} to re-cut it as an endorsement with no personal results, then: draft ${d.code} --testimonial=no`);

  const overdue = await db.query(`select * from v_deliverables where state = 'overdue' and collab_stage = 'accepted' order by due_on`);
  for (const d of overdue) add(2, 'late content', `${d.code} ${d.kind} from ${d.creator} for ${d.campaign}, ${n(d.days_late)} days late`, `chase ${d.creator} (/draft-chasers), then log it`);

  for (const o of (await owedRows()).filter((x) => x.state === 'OVERDUE')) add(2, 'payment', `${o.collab} ${o.creator}: ${cur(o.owed_cents, o.currency)} ${o.days_overdue} days overdue${o.invoice ? ' on ' + o.invoice : ''}`, `pay it, then: paid ${o.collab}`);

  const shipDays = n(SETTINGS.shipment_days || 5);
  const stuck = await db.query(`select g.code, g.product, g.sent_on, g.courier, g.tracking, k.creator, k.code as collab from gifts g join v_collabs k on k.id = g.collaboration_id
    where g.delivered_on is null and g.sent_on <= biz_today() - $1::int and k.stage = 'accepted'`, [shipDays]);
  for (const g of stuck) add(2, 'shipment', `${g.code} ${g.product} to ${g.creator} sent ${daysBetween(iso(g.sent_on), TODAY)} days ago, not delivered (${g.courier || ''} ${g.tracking || ''})`.replace(/\s+\)/, ')'), `check the tracking; once there: delivered ${g.code}`);

  const drafts = await db.query(`select * from v_deliverables where state = 'awaiting approval' and collab_stage = 'accepted' and not (is_testimonial and brand_category = 'therapeutic' and market like '%AU%') order by draft_received_on`);
  for (const d of drafts) add(3, 'approval', `${d.code} draft from ${d.creator} for ${d.campaign} waiting ${daysBetween(iso(d.draft_received_on), TODAY)} days, due ${iso(d.due_on)}`, `review it, then: approve ${d.code}`);

  const mDays = n(SETTINGS.metrics_days || 3);
  const noMetrics = await db.query(`select * from v_deliverables where posted_on is not null and posted_on <= biz_today() - $1::int and metrics_on is null and collab_stage in ('accepted', 'complete')`, [mDays]);
  for (const d of noMetrics) add(3, 'numbers', `${d.code} ${d.kind} from ${d.creator} posted ${daysBetween(iso(d.posted_on), TODAY)} days ago, no numbers captured`, `ask ${d.creator} for the insights, then: metrics ${d.code} --views= --likes= ...`);

  const quiet = n(SETTINGS.quiet_days || 7);
  const invites = await db.query(`select k.code, k.creator, k.campaign, k.invited_at from v_collabs k where k.stage = 'invited' and k.invited_at < now() - make_interval(days => $1::int)
    and not exists (select 1 from activities a where a.collaboration_id = k.id and a.direction = 'in')`, [quiet]);
  for (const k of invites) add(3, 'quiet', `${k.code} invite to ${k.creator} for ${k.campaign} sent ${daysBetween(iso(k.invited_at), TODAY)} days ago, no reply`, `one follow-up (/draft-outreach), or: decline ${k.code} --reason="no reply"`);
  const outreach = await db.query(`select c.code, c.full_name, max(a.at) as last_out from creators c join activities a on a.creator_id = c.id and a.direction = 'out'
    where c.status = 'contacted' and not exists (select 1 from activities a2 where a2.creator_id = c.id and a2.direction = 'in')
    group by c.id having max(a.at) < now() - make_interval(days => $1::int)`, [quiet]);
  for (const c of outreach) add(3, 'quiet', `${c.code} ${c.full_name}: first message ${daysBetween(iso(c.last_out), TODAY)} days ago, no reply`, 'one follow-up, or set them back to prospect');

  for (const r of (await (async () => { const o = []; const warn = n(SETTINGS.rights_warning_days || 30);
    for (const x of await db.query(`select k.code, k.creator, k.usage_rights_until, k.whitelisting, exists (select 1 from deliverables d where d.collaboration_id = k.id and d.ad_running) as running
      from v_collabs k where k.stage in ('accepted', 'complete') and k.usage_rights_until between biz_today() and biz_today() + $1::int`, [warn])) if (x.running || x.whitelisting) o.push(x);
    return o; })())) add(3, 'rights ending', `${r.code} ${r.creator}: usage rights end ${iso(r.usage_rights_until)} (${daysBetween(TODAY, iso(r.usage_rights_until))} days)${r.running ? ', content running as an ad' : ', whitelisted'}`, 'extend them or plan the ad to stop');

  items.sort((a, b) => a.rank - b.rank);
  out(items, (rs) => {
    if (!rs.length) { console.log('Nothing needs a person right now.'); return; }
    console.log(table(rs, [{ key: 'rank', label: '#' }, { key: 'area', label: 'Area' }, { key: 'what', label: 'What' }]));
  });
}

async function cmdCompliance(only) {
  let rows = await complianceRows();
  if (only) {
    rows = rows.filter((r) => r.id === only);
    if (!rows.length) throw new CliError('Rules: disclosure, therapeutic, agreement, rights');
  }
  out(rows, (rs) => {
    for (const r of rs) {
      console.log(`${r.count ? 'BREACH' : 'ok    '}  ${r.id.padEnd(12)} ${r.count}  ${r.rule}`);
      console.log(`        ${r.source}`);
      for (const i of r.items) console.log(`        - ${i.ref}  ${i.what}\n          fix: ${i.fix}`);
    }
  });
}

// ---------------------------------------------------------------- writes

async function logActivity(creatorId, collabId, kind, direction, body, by) {
  await db.query('insert into activities (creator_id, collaboration_id, kind, direction, body, by_name) values ($1, $2, $3, $4, $5, $6)', [creatorId, collabId, kind, direction, body, by || null]);
}

async function cmdAddCreator(flags) {
  const name = str(flags.name).trim();
  if (!name) throw new CliError('add-creator needs --name="Full Name" and --handle=@handle --platform=instagram');
  const handle = handleOf(flags.handle);
  const platform = str(flags.platform || 'instagram').toLowerCase();
  if (!PLATFORMS.includes(platform)) throw new CliError(`Platform is one of: ${PLATFORMS.join(', ')}`);
  if (handle) {
    const dup = await db.query('select c.code, c.full_name from creator_handles h join creators c on c.id = h.creator_id where h.platform = $1 and lower(h.handle) = lower($2)', [platform, handle]);
    if (dup.length) throw new CliError(`${handle} on ${platform} is already ${dup[0].code} ${dup[0].full_name}.`);
  }
  if (flags.email) {
    const dup = await db.query('select code, full_name from creators where lower(email) = lower($1)', [flags.email]);
    if (dup.length) throw new CliError(`${flags.email} is already ${dup[0].code} ${dup[0].full_name}.`);
  }
  const code = await nextCode('creators', 'CR-', 1, 2);
  const [c] = await db.query(`insert into creators (code, full_name, email, mobile, city, country, niche, status, rate_cents, notes)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`, [code, name, str(flags.email) || null, str(flags.mobile) || null, str(flags.city) || null, str(flags.country || 'NZ').toUpperCase(), str(flags.niche) || null, str(flags.status || 'prospect'), parseMoney(flags.rate, 'rate'), str(flags.notes) || null]);
  if (handle) await db.query('insert into creator_handles (creator_id, platform, handle, followers, engagement_rate, followers_checked_on) values ($1, $2, $3, $4, $5, biz_today())', [c.id, platform, handle, parseCount(flags.followers, 'followers'), flags.er ? Number(flags.er) : null]);
  out({ code, name, handle, platform }, () => console.log(`Added ${code} ${name}${handle ? ` (${handle} on ${platform})` : ''}.`));
}

async function cmdHandle(ref, flags) {
  const c = await findCreator(ref);
  const platform = str(flags.platform).toLowerCase();
  if (!PLATFORMS.includes(platform)) throw new CliError(`--platform is one of: ${PLATFORMS.join(', ')}`);
  const handle = handleOf(flags.handle);
  const followers = parseCount(flags.followers, 'followers');
  const ex = await db.query('select * from creator_handles where creator_id = $1 and platform = $2', [c.id, platform]);
  if (ex.length) await db.query('update creator_handles set handle = coalesce(nullif($2, \'\'), handle), followers = coalesce($3, followers), engagement_rate = coalesce($4, engagement_rate), followers_checked_on = biz_today() where id = $1', [ex[0].id, handle, followers, flags.er ? Number(flags.er) : null]);
  else {
    if (!handle) throw new CliError('A new handle needs --handle=@name');
    await db.query('insert into creator_handles (creator_id, platform, handle, followers, engagement_rate, followers_checked_on) values ($1, $2, $3, $4, $5, biz_today())', [c.id, platform, handle, followers, flags.er ? Number(flags.er) : null]);
  }
  out({ creator: c.code, platform, handle: handle || ex[0]?.handle, followers }, () => console.log(`${c.full_name} on ${platform} updated.`));
}

async function cmdStatus(ref, status, flags) {
  const c = await findCreator(ref);
  if (!CREATOR_STATUSES.includes(status)) throw new CliError(`Status is one of: ${CREATOR_STATUSES.join(', ')}`);
  if (['paused', 'do_not_use'].includes(status) && !flags.reason) throw new CliError(`Say why with --reason="..." so the next person knows.`);
  await db.query('update creators set status = $2, status_reason = $3 where id = $1', [c.id, status, str(flags.reason) || null]);
  if (flags.reason) await logActivity(c.id, null, 'note', 'internal', `Status ${status}: ${flags.reason}`, flags.by);
  out({ creator: c.code, status }, () => console.log(`${c.full_name} is now ${status}.`));
}

async function cmdBrandAdd(code, flags) {
  if (!code || !flags.name) throw new CliError('brand-add <CODE> --name="Brand" [--category=general|cosmetic|food|alcohol|therapeutic|financial] [--market=NZ|AU|NZ+AU] [--currency=NZD]');
  const category = str(flags.category || 'general');
  if (!BRAND_CATEGORIES.includes(category)) throw new CliError(`Category is one of: ${BRAND_CATEGORIES.join(', ')}`);
  const market = str(flags.market || 'NZ').toUpperCase();
  await db.query('insert into brands (code, name, category, market, currency, contact_name, contact_email) values ($1, $2, $3, $4, $5, $6, $7)', [String(code).toUpperCase(), flags.name, category, market, str(flags.currency || (market === 'AU' ? 'AUD' : 'NZD')).toUpperCase(), str(flags.contact) || null, str(flags.email) || null]);
  out({ code: String(code).toUpperCase(), name: flags.name, category, market }, () => console.log(`Added brand ${String(code).toUpperCase()} ${flags.name}.`));
}

async function cmdCampaignAdd(flags) {
  const b = await findBrand(flags.brand);
  if (!flags.name) throw new CliError('campaign-add needs --brand= --name="..." [--kind=paid|gifting|affiliate|ugc|ambassador] --starts= --ends= --budget=');
  const kind = str(flags.kind || 'paid');
  if (!CAMPAIGN_KINDS.includes(kind)) throw new CliError(`Kind is one of: ${CAMPAIGN_KINDS.join(', ')}`);
  const code = await nextCode('campaigns', 'CP-', 1, 2);
  const starts = parseDate(flags.starts, 'start date');
  const ends = parseDate(flags.ends, 'end date');
  if (starts && ends && ends < starts) throw new CliError('The campaign ends before it starts.');
  await db.query(`insert into campaigns (code, brand_id, name, kind, status, starts_on, ends_on, budget_cents, brief, disclosure_label, hashtag, discount_prefix, owner)
    values ($1, $2, $3, $4, 'planned', $5, $6, $7, $8, $9, $10, $11, $12)`, [code, b.id, flags.name, kind, starts, ends, parseMoney(flags.budget, 'budget') ?? 0, str(flags.brief) || null, str(flags.label || '#ad'), str(flags.hashtag) || null, str(flags.prefix) || null, str(flags.owner) || null]);
  const warn = b.category === 'therapeutic' && b.market.includes('AU') ? 'Therapeutic goods in Australia: brief creators for endorsements only, no personal results (TGA Advertising Code s 24(4)).' : null;
  out({ code, name: flags.name, brand: b.code, kind, warning: warn }, () => { console.log(`Added ${code} ${flags.name} for ${b.name} (planned).`); if (warn) console.log(warn); });
}

async function cmdCampaignStatus(ref, status) {
  const cp = await findCampaign(ref);
  if (!['planned', 'live', 'wrapped', 'cancelled'].includes(status)) throw new CliError('Status is one of: planned, live, wrapped, cancelled');
  await db.query('update campaigns set status = $2 where id = $1', [cp.id, status]);
  out({ campaign: cp.code, status }, () => console.log(`${cp.code} ${cp.name} is now ${status}.`));
}

// invite <campaign> <creator> --fee=900 --deliverables="reel:+14,story:+14"
async function cmdInvite(campaignRef, creatorRef, flags) {
  const cp = await findCampaign(campaignRef);
  const c = await findCreator(creatorRef);
  if (c.status === 'do_not_use') throw new CliError(`${c.full_name} is marked do not use: ${c.status_reason || 'no reason recorded'}. Change their status first if that has changed.`);
  if (c.status === 'paused') throw new CliError(`${c.full_name} is paused: ${c.status_reason || 'no reason recorded'}.`);
  if (['wrapped', 'cancelled'].includes(cp.status)) throw new CliError(`${cp.code} is ${cp.status}.`);
  const dup = await db.query('select code, stage from collaborations where campaign_id = $1 and creator_id = $2', [cp.id, c.id]);
  if (dup.length) throw new CliError(`${c.full_name} is already on ${cp.code} as ${dup[0].code} (${dup[0].stage}).`);
  const fee = parseMoney(flags.fee, 'fee') ?? (cp.kind === 'gifting' ? 0 : n(c.rate_cents));
  const code = await nextCode('collaborations', 'K-', 1001);
  const [mh] = await db.query('select handle, platform from v_creator_main_handle where creator_id = $1', [c.id]);
  const dcode = cp.discount_prefix && mh ? `${cp.discount_prefix}-${mh.handle.replace(/^@/, '').split(/[._]/)[0].toUpperCase()}` : null;
  const taken = dcode ? await db.query('select 1 from collaborations where discount_code = $1', [dcode]) : [];
  const [k] = await db.query(`insert into collaborations (code, campaign_id, creator_id, stage, fee_cents, discount_code, notes) values ($1, $2, $3, 'invited', $4, $5, $6) returning id`, [code, cp.id, c.id, fee, taken.length ? null : dcode, str(flags.notes) || null]);
  const dels = [];
  for (const part of str(flags.deliverables).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [kind, due] = part.split(':');
    if (!KINDS.includes(kind)) throw new CliError(`Deliverable kind "${kind}" is not one of: ${KINDS.join(', ')}`);
    const dc = await nextCode('deliverables', 'P-', 2001);
    await db.query('insert into deliverables (code, collaboration_id, kind, platform, due_on) values ($1, $2, $3, $4, $5)', [dc, k.id, kind, mh?.platform || null, parseDate(due || '+14', 'due date')]);
    dels.push(dc);
  }
  await logActivity(c.id, k.id, 'note', 'internal', `Invited to ${cp.name}, fee ${cur(fee, cp.currency)}.`, flags.by);
  const warn = cp.brand_category === 'therapeutic' && String(cp.market).includes('AU') ? 'Therapeutic goods in Australia: the brief must ask for an endorsement, not a testimonial (TGA Advertising Code s 24(4)).' : null;
  out({ code, campaign: cp.code, creator: c.code, fee_cents: fee, discount_code: taken.length ? null : dcode, deliverables: dels, warning: warn }, () => {
    console.log(`${code}: ${c.full_name} invited to ${cp.name} at ${cur(fee, cp.currency)}${dels.length ? `, deliverables ${dels.join(', ')}` : ''}.`);
    if (warn) console.log(warn);
    console.log(`Draft the invite: /draft-outreach ${code}`);
  });
}

async function cmdRespond(ref, stage, flags) {
  const k = await findCollab(ref);
  if (stage === 'accepted' && k.stage !== 'invited') throw new CliError(`${k.code} is ${k.stage}, not waiting for an answer.`);
  if (['declined', 'cancelled'].includes(stage) && !flags.reason) throw new CliError('Say why with --reason="..."');
  if (stage === 'declined' && k.stage !== 'invited') throw new CliError(`${k.code} is ${k.stage}; to end an accepted deal use: cancel ${k.code} --reason="..."`);
  await db.query('update collaborations set stage = $2, responded_at = case when $2 in (\'accepted\', \'declined\') then now() else responded_at end, stage_reason = $3 where id = $1', [k.id, stage, str(flags.reason) || null]);
  if (stage === 'accepted' && k.creator_status !== 'active') await db.query(`update creators set status = 'active' where id = $1 and status in ('prospect', 'contacted')`, [k.creator_id]);
  await logActivity(k.creator_id, k.id, 'note', stage === 'accepted' ? 'in' : 'internal', `${stage}${flags.reason ? ': ' + flags.reason : ''}`, flags.by);
  const next = stage === 'accepted' && !k.agreement_signed_on ? `Send the brief and terms before any product ships: /draft-brief ${k.code}` : null;
  out({ code: k.code, stage, next }, () => { console.log(`${k.code} ${k.creator} on ${k.campaign}: ${stage}.`); if (next) console.log(next); });
}

async function cmdAgreement(ref, flags) {
  const k = await findCollab(ref);
  const signed = flags.signed ? parseDate(flags.signed, 'signed date') : null;
  const until = flags['rights-until'] ? parseDate(flags['rights-until'], 'rights date') : flags.rights ? parseDate(String(flags.rights).startsWith('+') ? flags.rights : `+${flags.rights}`, 'rights date') : null;
  const sets = [];
  const params = [k.id];
  const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (signed) set('agreement_signed_on', signed);
  if (flags.ref) set('agreement_ref', str(flags.ref));
  if (until) set('usage_rights_until', until);
  if (flags.scope) set('usage_rights_scope', str(flags.scope));
  if (flags.whitelisting !== undefined) set('whitelisting', flags.whitelisting === true || yes(flags.whitelisting));
  if (flags['exclusive-until']) set('exclusivity_until', parseDate(flags['exclusive-until'], 'exclusivity date'));
  if (flags.fee) set('fee_cents', parseMoney(flags.fee, 'fee'));
  if (!sets.length) throw new CliError('agreement <collab> --signed=today [--ref=] [--rights=90 | --rights-until=<date>] [--scope="..."] [--whitelisting] [--exclusive-until=<date>] [--fee=]');
  await db.query(`update collaborations set ${sets.join(', ')} where id = $1`, params);
  const [after] = await db.query('select agreement_signed_on, usage_rights_until, whitelisting from collaborations where id = $1', [k.id]);
  out({ code: k.code, agreement_signed_on: iso(after.agreement_signed_on) || null, usage_rights_until: iso(after.usage_rights_until) || null, whitelisting: after.whitelisting }, (x) => console.log(`${k.code} ${k.creator}: terms ${x.agreement_signed_on ? 'signed ' + x.agreement_signed_on : 'not signed yet'}, usage rights ${x.usage_rights_until ? 'until ' + x.usage_rights_until : 'none'}${x.whitelisting ? ', whitelisting allowed' : ''}.`));
}

async function cmdDeliverable(ref, flags) {
  const k = await findCollab(ref);
  const kind = str(flags.kind);
  if (!KINDS.includes(kind)) throw new CliError(`--kind is one of: ${KINDS.join(', ')}`);
  const code = await nextCode('deliverables', 'P-', 2001);
  await db.query('insert into deliverables (code, collaboration_id, kind, platform, due_on) values ($1, $2, $3, $4, $5)', [code, k.id, kind, str(flags.platform) || k.platform, parseDate(flags.due || '+14', 'due date')]);
  out({ code, collab: k.code, kind }, () => console.log(`${code}: ${kind} from ${k.creator} added to ${k.code}.`));
}

async function cmdShip(ref, flags) {
  const k = await findCollab(ref);
  if (k.stage !== 'accepted') throw new CliError(`${k.code} is ${k.stage}. Product ships once the creator has said yes.`);
  if (!flags.product) throw new CliError('ship <collab> --product="..." --value=<cost> [--courier= --tracking=] [--sent=today]');
  const code = await nextCode('gifts', 'G-', 301);
  const value = parseMoney(flags.value, 'value') ?? 0;
  await db.query('insert into gifts (code, collaboration_id, product, value_cents, sent_on, courier, tracking) values ($1, $2, $3, $4, $5, $6, $7)', [code, k.id, flags.product, value, parseDate(flags.sent || 'today'), str(flags.courier) || null, str(flags.tracking) || null]);
  const warn = k.agreement_signed_on ? null : `${k.code} has no signed terms yet. The terms are what tells the creator to label the post as an ad: send them now (/draft-brief ${k.code}).`;
  out({ code, collab: k.code, value_cents: value, warning: warn }, () => { console.log(`${code}: ${flags.product} to ${k.creator} recorded as sent.`); if (warn) console.log(warn); });
}

async function cmdDelivered(ref, flags) {
  const r = String(ref || '');
  let g = (await db.query('select g.*, k.creator from gifts g join v_collabs k on k.id = g.collaboration_id where lower(g.code) = lower($1)', [r]))[0];
  if (!g) {
    const k = await findCollab(r);
    const rows = await db.query('select g.*, $2::text as creator from gifts g where g.collaboration_id = $1 and g.delivered_on is null', [k.id, k.creator]);
    if (rows.length !== 1) throw new CliError(rows.length ? `More than one gift on ${k.code} is in transit: ${rows.map((x) => x.code).join(', ')}` : `Nothing in transit on ${k.code}.`);
    g = rows[0];
  }
  const on = parseDate(flags.on || 'today');
  await db.query('update gifts set delivered_on = $2 where id = $1', [g.id, on]);
  out({ code: g.code, delivered_on: on }, () => console.log(`${g.code} delivered to ${g.creator} on ${on}.`));
}

// A draft has come in for approval. --testimonial=yes|no records whether the creator describes their own use.
async function cmdDraft(ref, flags) {
  const d = await findDeliverable(ref);
  if (d.posted_on) throw new CliError(`${d.code} is already posted.`);
  const testimonial = flags.testimonial === undefined ? d.is_testimonial : yes(flags.testimonial);
  // A new cut resets any approval: the approved version is the one that goes up.
  await db.query('update deliverables set draft_received_on = $2, draft_note = coalesce($3, draft_note), is_testimonial = $4, approved_on = null, approved_by = null where id = $1', [d.id, parseDate(flags.on || 'today'), str(flags.note) || null, testimonial]);
  const tga = testimonial && d.brand_category === 'therapeutic' && String(d.market).includes('AU');
  out({ code: d.code, is_testimonial: testimonial, can_approve: !tga }, () => {
    console.log(`${d.code} draft from ${d.creator} recorded${testimonial ? ' as a testimonial' : ''}.`);
    if (tga) console.log(`This is a testimonial for therapeutic goods in Australia from a paid or gifted creator. It cannot be approved (TGA Advertising Code s 24(4)).`);
  });
}

async function cmdApprove(ref, flags) {
  const d = await findDeliverable(ref);
  if (d.posted_on) throw new CliError(`${d.code} is already posted.`);
  if (!d.draft_received_on) throw new CliError(`No draft recorded for ${d.code}. When it comes in: draft ${d.code}`);
  // The law, not a setting: TGA Advertising Code s 24(4). No force flag.
  if (d.is_testimonial && d.brand_category === 'therapeutic' && String(d.market).includes('AU') && (n(d.fee_cents) > 0 || n(d.gift_cents) > 0)) {
    throw new CliError(`Refused: ${d.code} is a testimonial for ${d.brand}, therapeutic goods advertised in Australia, from a creator who was paid or gifted. Section 24(4) of the TGA Advertising Code bans it whether or not it is labelled. Ask ${d.creator} for an endorsement with no personal results, then record the new cut: draft ${d.code} --testimonial=no`);
  }
  if (!d.agreement_signed_on) throw new CliError(`Refused: ${d.collab_code} has no signed terms. Approve once the creator has signed the brief that tells them how to label the post: agreement ${d.collab_code} --signed=today`);
  await db.query('update deliverables set approved_on = biz_today(), approved_by = $2 where id = $1', [d.id, str(flags.by) || null]);
  out({ code: d.code, approved: true, label: d.required_label }, () => console.log(`${d.code} approved. Remind ${d.creator} the caption starts with "${d.required_label}".`));
}

async function cmdPosted(ref, flags) {
  const d = await findDeliverable(ref);
  if (!flags.url && !d.post_url) throw new CliError('posted <deliverable> --url=<link to the post> --label="#ad" [--end if the label is not upfront] [--testimonial=yes|no] [--on=today]');
  const label = flags.label === undefined ? d.disclosure_label : flags.label === true ? null : str(flags.label);
  const upfront = label ? !flags.end : null;
  const testimonial = flags.testimonial === undefined ? d.is_testimonial : yes(flags.testimonial);
  await db.query('update deliverables set posted_on = coalesce($2, posted_on, biz_today()), post_url = coalesce($3, post_url), disclosure_label = $4, label_upfront = $5, is_testimonial = $6 where id = $1', [d.id, flags.on ? parseDate(flags.on) : null, str(flags.url) || null, label, upfront, testimonial]);
  // The post is live whatever we record, so it is recorded and the breach is flagged rather than refused.
  const problems = [];
  if (!label) problems.push('it carries no ad label');
  else if (!labelOk(label)) problems.push(`"${label}" is not one of the accepted labels (${labels().join(', ')})`);
  if (label && !upfront) problems.push('the label is not upfront');
  if (testimonial && d.brand_category === 'therapeutic' && String(d.market).includes('AU') && (n(d.fee_cents) > 0 || n(d.gift_cents) > 0)) problems.push('it is a paid or gifted testimonial for therapeutic goods in Australia (TGA Advertising Code s 24(4))');
  const [k] = await db.query('select posted, deliverables from v_collabs where id = $1', [d.collab_id]);
  if (n(k.posted) === n(k.deliverables)) await db.query(`update collaborations set stage = 'complete' where id = $1 and stage = 'accepted' and fee_cents = 0`, [d.collab_id]);
  out({ code: d.code, posted: true, disclosure_ok: !problems.length, problems }, () => {
    console.log(`${d.code} posted by ${d.creator}.`);
    if (problems.length) console.log(`Breach: ${problems.join('; ')}. Ask ${d.creator} to fix it today, then record it again.`);
  });
}

async function cmdMetrics(ref, flags) {
  const d = await findDeliverable(ref);
  if (!d.posted_on) throw new CliError(`${d.code} is not posted yet.`);
  const v = (k) => parseCount(flags[k], k) ?? 0;
  const row = { views: v('views'), reach: v('reach'), likes: v('likes'), comments: v('comments'), shares: v('shares'), saves: v('saves'), link_clicks: v('clicks'), code_uses: v('code-uses') };
  if (!Object.values(row).some(Boolean) && !flags.sales) throw new CliError('metrics <deliverable> --views= --reach= --likes= --comments= --shares= --saves= --clicks= --code-uses= --sales= [--on=today] [--source="..."]');
  const sales = parseMoney(flags.sales, 'sales') ?? 0;
  await db.query(`insert into post_metrics (deliverable_id, captured_on, views, reach, likes, comments, shares, saves, link_clicks, code_uses, sales_cents, source)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [d.id, parseDate(flags.on || 'today'), row.views, row.reach, row.likes, row.comments, row.shares, row.saves, row.link_clicks, row.code_uses, sales, str(flags.source) || null]);
  const eng = row.likes + row.comments + row.shares + row.saves;
  out({ code: d.code, ...row, sales_cents: sales, engagements: eng }, () => console.log(`${d.code}: ${int(row.views)} views, ${int(eng)} engagements, ${row.code_uses} code uses recorded.`));
}

async function cmdAd(ref, onOff) {
  const d = await findDeliverable(ref);
  if (!['on', 'off'].includes(onOff)) throw new CliError('ad <deliverable> on|off');
  if (onOff === 'on') {
    if (!d.posted_on) throw new CliError(`${d.code} is not posted yet.`);
    if (!d.usage_rights_until || iso(d.usage_rights_until) < TODAY) throw new CliError(`Refused: ${d.collab_code} has ${d.usage_rights_until ? `usage rights that ended ${iso(d.usage_rights_until)}` : 'no usage rights recorded'}. Agree them with ${d.creator} first: agreement ${d.collab_code} --rights-until=<date>`);
  }
  await db.query('update deliverables set ad_running = $2, ad_running_since = case when $2 then biz_today() else null end where id = $1', [d.id, onOff === 'on']);
  out({ code: d.code, ad_running: onOff === 'on' }, () => console.log(`${d.code} ${onOff === 'on' ? `is running as an ad, rights until ${iso(d.usage_rights_until)}` : 'is no longer running as an ad'}.`));
}

// invoice: record what the creator has billed. paid: record that it has been paid.
async function cmdInvoice(ref, flags) {
  const k = await findCollab(ref);
  const amount = parseMoney(flags.amount, 'amount') ?? n(k.fee_cents) - n(k.paid_cents);
  if (!amount) throw new CliError(`Nothing is owed on ${k.code}.`);
  await db.query('insert into payments (collaboration_id, amount_cents, due_on, invoice_ref) values ($1, $2, $3, $4)', [k.id, amount, parseDate(flags.due || `+${k.fee_due_days}`), str(flags.ref) || null]);
  out({ collab: k.code, amount_cents: amount }, () => console.log(`${k.code}: invoice for ${cur(amount, k.currency)} recorded.`));
}

async function cmdPaid(ref, flags) {
  const k = await findCollab(ref);
  const owed = n(k.fee_cents) - n(k.paid_cents);
  if (owed <= 0) throw new CliError(`${k.code} ${k.creator} is paid in full (${cur(k.paid_cents, k.currency)}).`);
  const amount = parseMoney(flags.amount, 'amount') ?? owed;
  if (amount > owed) throw new CliError(`Refused: ${cur(amount, k.currency)} is more than the ${cur(owed, k.currency)} still owed on ${k.code}. Change the fee first if it has changed: agreement ${k.code} --fee=`);
  const on = parseDate(flags.on || 'today');
  const open = await db.query('select id, amount_cents from payments where collaboration_id = $1 and paid_on is null order by due_on nulls last', [k.id]);
  const match = open.find((p) => n(p.amount_cents) === amount);
  if (match) await db.query('update payments set paid_on = $2, method = $3, invoice_ref = coalesce($4, invoice_ref) where id = $1', [match.id, on, str(flags.method) || null, str(flags.ref) || null]);
  else await db.query('insert into payments (collaboration_id, amount_cents, due_on, invoice_ref, paid_on, method) values ($1, $2, $3, $4, $3, $5)', [k.id, amount, on, str(flags.ref) || null, str(flags.method) || null]);
  if (amount === owed) {
    const [x] = await db.query('select posted, deliverables from v_collabs where id = $1', [k.id]);
    if (n(x.posted) === n(x.deliverables) && n(x.deliverables) > 0) await db.query(`update collaborations set stage = 'complete' where id = $1 and stage = 'accepted'`, [k.id]);
  }
  out({ collab: k.code, paid_cents: amount, still_owed_cents: owed - amount }, () => console.log(`${k.code}: ${cur(amount, k.currency)} to ${k.creator} recorded as paid on ${on}.${owed - amount ? ` ${cur(owed - amount, k.currency)} still owed.` : ''}`));
}

async function cmdLog(ref, text, flags) {
  if (!text) throw new CliError('log <creator|collab> "what happened" --kind=email|dm|call|meeting|note [--in] [--by=]');
  const kind = str(flags.kind || 'note');
  if (!['email', 'dm', 'call', 'meeting', 'note'].includes(kind)) throw new CliError('--kind is one of: email, dm, call, meeting, note');
  let creatorId, collabId = null, who;
  const asCollab = await db.query('select * from v_collabs where lower(code) = lower($1)', [ref]);
  if (asCollab.length) { creatorId = asCollab[0].creator_id; collabId = asCollab[0].id; who = asCollab[0].creator; }
  else { const c = await findCreator(ref); creatorId = c.id; who = c.full_name; }
  const direction = kind === 'note' ? 'internal' : flags.in ? 'in' : 'out';
  await logActivity(creatorId, collabId, kind, direction, text, flags.by);
  if (direction === 'out') await db.query(`update creators set status = 'contacted' where id = $1 and status = 'prospect'`, [creatorId]);
  out({ creator: who, kind, direction }, () => console.log(`Logged ${kind} ${direction === 'in' ? 'from' : 'with'} ${who}.`));
}

// ---------------------------------------------------------------- import and export

// GRIN's creator export (and most others) arrive as CSV with one row per creator. The column names
// depend on the fields chosen at export, so this reads the common ones and reports what it skips.
async function cmdImport(kind, file, flags) {
  if (!['creators', 'grin', 'metrics'].includes(kind) || !file) throw new CliError('import creators|grin <file.csv> [--dry-run]   or   import metrics <file.csv> [--dry-run]');
  if (!existsSync(file)) throw new CliError(`No file at ${file}`);
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const dry = !!flags['dry-run'];
  if (kind === 'metrics') return importMetrics(rows, dry);
  const report = { rows: rows.length, created: 0, updated: 0, handles: 0, skipped: [] };
  await db.exec('BEGIN');
  try {
    for (const [i, r] of rows.entries()) {
      const first = pick(r, 'first name', 'firstname');
      const last = pick(r, 'last name', 'lastname', 'surname');
      const name = pick(r, 'name', 'full name', 'creator name', 'creator', 'influencer', 'influencer name', 'display name') || [first, last].filter(Boolean).join(' ');
      const email = pick(r, 'email', 'email address', 'contact email', 'primary email');
      const ref = pick(r, 'id', 'creator id', 'contact id', 'grin id', 'record id');
      const handles = [];
      for (const p of ['instagram', 'tiktok', 'youtube', 'facebook', 'pinterest']) {
        const h = pick(r, `${p} handle`, `${p} username`, p, `${p} url`, `${p} profile`);
        if (h) handles.push({ platform: p, handle: handleOf(h), followers: parseCount(pick(r, `${p} followers`, `${p} follower count`, `${p} subscribers`) || null, 'followers'), er: pick(r, `${p} engagement rate`, `${p} engagement`) });
      }
      if (!name && !email) { report.skipped.push({ row: i + 2, why: 'no name or email' }); continue; }
      let c = null;
      if (ref) c = (await db.query('select * from creators where external_ref = $1', [ref]))[0];
      if (!c && email) c = (await db.query('select * from creators where lower(email) = lower($1)', [email]))[0];
      if (!c) {
        for (const h of handles) if (!c) c = (await db.query('select c.* from creators c join creator_handles ch on ch.creator_id = c.id where ch.platform = $1 and lower(ch.handle) = lower($2)', [h.platform, h.handle]))[0];
        // A handle match with a different email is two people, or a typo: never merge them silently.
        if (c && email && c.email && c.email.toLowerCase() !== email.toLowerCase()) {
          report.skipped.push({ row: i + 2, why: `a handle belongs to ${c.code} ${c.full_name}, whose email is not ${email}` });
          continue;
        }
      }
      const statusRaw = String(pick(r, 'stage', 'status', 'relationship stage') || '').toLowerCase();
      const status = /activ|partner|ambassador|approved/.test(statusRaw) ? 'active' : /contact|outreach|negotiat|pending/.test(statusRaw) ? 'contacted' : /do not|blacklist|reject|remove/.test(statusRaw) ? 'do_not_use' : 'prospect';
      const fields = { email: email || null, mobile: pick(r, 'phone', 'phone number', 'mobile') || null, city: pick(r, 'city') || null, country: (pick(r, 'country', 'country code') || '').slice(0, 2).toUpperCase() || null, niche: pick(r, 'niche', 'category', 'tags') || null, postal_address: [pick(r, 'address', 'address 1', 'street address', 'shipping address'), pick(r, 'address 2'), pick(r, 'postcode', 'zip', 'postal code')].filter(Boolean).join(', ') || null, notes: pick(r, 'notes', 'note') || null };
      if (c) {
        await db.query(`update creators set email = coalesce(email, $2), mobile = coalesce(mobile, $3), city = coalesce(city, $4), country = coalesce($5, country), niche = coalesce(niche, $6), postal_address = coalesce(postal_address, $7), external_ref = coalesce(external_ref, $8) where id = $1`, [c.id, fields.email, fields.mobile, fields.city, fields.country, fields.niche, fields.postal_address, ref || null]);
        report.updated++;
      } else {
        const code = await nextCode('creators', 'CR-', 1, 2);
        c = (await db.query(`insert into creators (code, full_name, email, mobile, city, country, niche, status, postal_address, external_ref, notes) values ($1, $2, $3, $4, $5, coalesce($6, 'NZ'), $7, $8, $9, $10, $11) returning *`, [code, name || email, fields.email, fields.mobile, fields.city, fields.country, fields.niche, status, fields.postal_address, ref || null, fields.notes]))[0];
        report.created++;
      }
      for (const h of handles) {
        const ex = await db.query('select id, creator_id from creator_handles where platform = $1 and lower(handle) = lower($2)', [h.platform, h.handle]);
        if (ex.length && ex[0].creator_id !== c.id) { report.skipped.push({ row: i + 2, why: `${h.handle} on ${h.platform} already belongs to another creator` }); continue; }
        if (ex.length) await db.query('update creator_handles set followers = coalesce($2, followers), followers_checked_on = biz_today() where id = $1', [ex[0].id, h.followers]);
        else { await db.query('insert into creator_handles (creator_id, platform, handle, followers, engagement_rate, followers_checked_on) values ($1, $2, $3, $4, $5, biz_today())', [c.id, h.platform, h.handle, h.followers, h.er ? Number(String(h.er).replace('%', '')) : null]); report.handles++; }
      }
    }
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  report.dry_run = dry;
  out(report, (x) => {
    console.log(`${dry ? 'Dry run: would create' : 'Created'} ${x.created} creators, ${dry ? 'update' : 'updated'} ${x.updated}, ${x.handles} new handles, from ${x.rows} rows.`);
    for (const s of x.skipped) console.log(`  row ${s.row}: skipped, ${s.why}`);
    if (dry) console.log('Nothing was saved. Run again without --dry-run to import.');
  });
}

async function importMetrics(rows, dry) {
  const report = { rows: rows.length, recorded: 0, skipped: [], dry_run: dry };
  await db.exec('BEGIN');
  try {
    for (const [i, r] of rows.entries()) {
      const ref = pick(r, 'deliverable', 'code', 'post code');
      const url = pick(r, 'url', 'post url', 'link', 'permalink');
      const d = ref ? (await db.query('select id from deliverables where lower(code) = lower($1)', [ref]))[0] : url ? (await db.query('select id from deliverables where post_url = $1', [url]))[0] : null;
      if (!d) { report.skipped.push({ row: i + 2, why: `no posted deliverable matches ${ref || url || 'this row'}` }); continue; }
      const num = (...k) => parseCount(pick(r, ...k) || null, k[0]) ?? 0;
      await db.query(`insert into post_metrics (deliverable_id, captured_on, views, reach, likes, comments, shares, saves, link_clicks, code_uses, sales_cents, source) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'import')`,
        [d.id, parseDate(pick(r, 'date', 'captured', 'captured on') || 'today'), num('views', 'plays', 'impressions'), num('reach'), num('likes'), num('comments'), num('shares'), num('saves'), num('link clicks', 'clicks'), num('code uses', 'orders'), parseMoney(pick(r, 'sales', 'revenue') || null) ?? 0]);
      report.recorded++;
    }
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  out(report, (x) => { console.log(`${dry ? 'Dry run: would record' : 'Recorded'} numbers for ${x.recorded} of ${x.rows} rows.`); for (const s of x.skipped) console.log(`  row ${s.row}: skipped, ${s.why}`); });
}

async function cmdExport(flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || 'export');
  mkdirSync(dir, { recursive: true });
  const tables = ['brands', 'creators', 'creator_handles', 'campaigns', 'collaborations', 'gifts', 'deliverables', 'post_metrics', 'payments', 'activities'];
  const esc = (v) => { if (v === null || v === undefined) return ''; const s = v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const res = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at`);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');
    res[t] = rows.length;
  }
  out({ dir, tables: res }, () => { for (const [t, c] of Object.entries(res)) console.log(`  ${t.padEnd(16)} ${c}`); console.log(`Exported to ${dir}`); });
}

// ---------------------------------------------------------------- main

const HELP = `influencer-marketing-for-claude-code

  The day
    attention                                everything that needs a person, worst first
    stats                                    the programme in numbers
    due [--days=14]                          content due, late or waiting for approval
    owed                                     fees owed to creators and when they fall due
    compliance [disclosure|therapeutic|agreement|rights]

  Creators
    creators [--status= --niche= --platform= --country= --all]
    creator <name|code|handle|email>         the whole story of one creator
    add-creator --name= --handle= --platform= [--followers= --er= --email= --niche= --rate= --country= --city=]
    handle <creator> --platform= [--handle=] [--followers=] [--er=]
    status <creator> prospect|contacted|active|paused|do_not_use [--reason=]
    shortlist <campaign> [--niche= --platform= --min-followers=]

  Campaigns
    brands  |  brand-add <CODE> --name= [--category= --market= --currency=]
    campaigns [--all]  |  campaign <campaign>
    campaign-add --brand= --name= --kind= --starts= --ends= --budget= [--label= --brief= --hashtag= --prefix= --owner=]
    campaign-status <campaign> planned|live|wrapped|cancelled
    collabs [--all]

  Collaborations
    invite <campaign> <creator> [--fee=] [--deliverables="reel:+14,story:+14"]
    accept <collab>  |  decline <collab> --reason=  |  cancel <collab> --reason=
    agreement <collab> --signed=today [--ref= --rights=90 | --rights-until= --scope= --whitelisting --exclusive-until= --fee=]
    deliverable <collab> --kind= --due=
    ship <collab> --product= --value= [--courier= --tracking= --sent=]
    delivered <gift|collab>
    draft <deliverable> [--note=] [--testimonial=yes|no]
    approve <deliverable> [--by=]
    posted <deliverable> --url= --label="#ad" [--end] [--testimonial=no] [--on=]
    metrics <deliverable> --views= --likes= --comments= --shares= --saves= --clicks= --code-uses= --sales=
    ad <deliverable> on|off                  running the content as a paid ad
    invoice <collab> [--amount= --due= --ref=]  |  paid <collab> [--amount= --ref= --method= --on=]
    log <creator|collab> "what happened" --kind=email|dm|call|meeting|note [--in]

  Results
    results [campaign]                       cost, engagements, code uses and sales per campaign and creator
    leaderboard [--by=engagement|sales]      every creator who has posted, on what they really cost
    gifting                                  every gift sent and whether it turned into a post
    rights                                   usage rights, whitelisting and content running as ads
    spend                                    budget, committed and paid per brand

  Data
    import creators|grin <file.csv> [--dry-run]
    import metrics <file.csv> [--dry-run]
    export [--out=<dir>]

  Add --json to any command for machine output.`;

async function main() {
  const { args, flags } = parseArgv(process.argv.slice(2));
  JSON_OUT = !!flags.json;
  const [cmd, ...rest] = args;
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }
  db = await getDb();
  try {
    SETTINGS = Object.fromEntries((await db.query('select key, value from settings')).map((r) => [r.key, r.value]));
    TODAY = (await db.query('select biz_today()::text as d'))[0].d;
    const handlers = {
      stats: () => cmdStats(),
      attention: () => cmdAttention(),
      due: () => cmdDue(flags),
      owed: () => cmdOwed(),
      compliance: () => cmdCompliance(rest[0]),
      creators: () => cmdCreators(flags),
      creator: () => cmdCreator(rest.join(' ')),
      'add-creator': () => cmdAddCreator(flags),
      handle: () => cmdHandle(rest.join(' '), flags),
      status: () => cmdStatus(rest[0], rest[1], flags),
      shortlist: () => cmdShortlist(rest.join(' '), flags),
      brands: () => cmdBrands(),
      'brand-add': () => cmdBrandAdd(rest[0], flags),
      campaigns: () => cmdCampaigns(flags),
      campaign: () => cmdCampaign(rest.join(' ')),
      'campaign-add': () => cmdCampaignAdd(flags),
      'campaign-status': () => cmdCampaignStatus(rest[0], rest[1]),
      collabs: () => cmdCollabs(flags),
      invite: () => cmdInvite(rest[0], rest.slice(1).join(' '), flags),
      accept: () => cmdRespond(rest.join(' '), 'accepted', flags),
      decline: () => cmdRespond(rest.join(' '), 'declined', flags),
      cancel: () => cmdRespond(rest.join(' '), 'cancelled', flags),
      agreement: () => cmdAgreement(rest.join(' '), flags),
      deliverable: () => cmdDeliverable(rest.join(' '), flags),
      ship: () => cmdShip(rest.join(' '), flags),
      delivered: () => cmdDelivered(rest.join(' '), flags),
      draft: () => cmdDraft(rest.join(' '), flags),
      approve: () => cmdApprove(rest.join(' '), flags),
      posted: () => cmdPosted(rest.join(' '), flags),
      metrics: () => cmdMetrics(rest.join(' '), flags),
      ad: () => cmdAd(rest[0], rest[1]),
      invoice: () => cmdInvoice(rest.join(' '), flags),
      paid: () => cmdPaid(rest.join(' '), flags),
      log: () => cmdLog(rest[0], rest.slice(1).join(' '), flags),
      results: () => cmdResults(rest.join(' ') || null),
      leaderboard: () => cmdLeaderboard(flags),
      gifting: () => cmdGifting(),
      rights: () => cmdRights(),
      spend: () => cmdSpend(),
      import: () => cmdImport(rest[0], rest[1], flags),
      export: () => cmdExport(flags),
    };
    const h = handlers[cmd];
    if (!h) throw new CliError(`Unknown command "${cmd}". Run: creators help`);
    await h();
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  if (e instanceof CliError) { console.error(e.message); process.exit(e.code); }
  console.error(e.stack || e.message);
  process.exit(1);
});
