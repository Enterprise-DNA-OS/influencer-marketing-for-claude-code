#!/usr/bin/env node
// End-to-end smoke test on a throwaway embedded database: migrate, seed, then every command
// that matters, asserting on the JSON. Passes on Windows and Linux. No network, no Postgres install.
// TEST_DATABASE_URL runs the same test against a real Postgres (CI does this).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'creators-smoke-'));
const outDir = path.join(dataDir, 'out');
const env = { ...process.env, DATA_DIR: dataDir, OUTPUT_DIR: outDir };
delete env.DATABASE_URL;
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try { return JSON.parse(res.stdout); } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}
function assert(cond, msg) { if (!cond) { console.error(`\nFAIL assertion: ${msg}`); process.exit(1); } }
const C = (...a) => ['creators.mjs', ...a];
const counts = (comp) => Object.fromEntries(comp.map((x) => [x.id, x.count]));
const refused = (label, args, pattern) => {
  const r = run(label, args, { json: false, expectFail: true });
  assert(pattern.test(r.stderr), `${label}: expected ${pattern}, got "${r.stderr.trim()}"`);
};

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres' : 'embedded database in ' + dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the day
  const stats = run('stats', C('stats'));
  assert(stats.active_creators === 7 && stats.live_campaigns === 3 && stats.open_collabs === 7 && stats.invites_out === 2, `stats ${JSON.stringify(stats)}`);
  assert(stats.content_overdue === 2 && stats.awaiting_approval === 2 && stats.fees_overdue === 1 && stats.compliance_breaches === 5, `stats ${JSON.stringify(stats)}`);
  const comp = counts(run('compliance', C('compliance')));
  assert(comp.disclosure === 1 && comp.therapeutic === 1 && comp.agreement === 2 && comp.rights === 1, `compliance ${JSON.stringify(comp)}`);
  assert(run('compliance one rule', C('compliance', 'rights'))[0].items[0].ref === 'P-2010', 'the whitelisted Spring Glow reel is past its rights');
  const att = run('attention', C('attention'));
  assert(att[0].rank === 1, 'breaches lead the list');
  for (const area of ['disclosure', 'therapeutic', 'agreement', 'rights', 'late content', 'payment', 'shipment', 'approval', 'numbers', 'quiet', 'rights ending']) assert(att.some((a) => a.area === area), `attention has ${area}`);
  assert(att.some((a) => a.area === 'therapeutic' && /P-2008/.test(a.what)), 'the vitamin testimonial draft is flagged before approval');
  assert(att.filter((a) => a.area === 'quiet').length === 2 && !att.some((a) => /K-1013/.test(a.what)), 'two quiet, the two-day-old invite is not');
  const due = run('due', C('due'));
  assert(due.filter((d) => d.state === 'overdue').length === 2 && due[0].code === 'P-2006', 'two late, Tom first');
  const owed = run('owed', C('owed'));
  const aroha = owed.find((o) => o.collab === 'K-1001');
  assert(aroha.state === 'OVERDUE' && aroha.owed_cents === 90000 && aroha.days_overdue === 2, 'Aroha is owed $900, two days late');
  assert(owed.find((o) => o.collab === 'K-1008').owed_cents === 50000, 'Grace is owed the balance after her deposit');
  const board = run('leaderboard', C('leaderboard'));
  assert(board[0].code === 'CR-03' && board[0].currency === 'NZD', 'Jack is the cheapest engagement');
  assert(board.find((b) => b.code === 'CR-01').engagements === 11092, 'Aroha engagements from the latest capture only');
  const res4 = run('results CP-04', C('results', 'CP-04'));
  assert(res4.sales_cents === 1883000 && res4.cost_cents === 409500, `Spring Glow results ${res4.sales_cents} ${res4.cost_cents}`);
  assert(res4.creators.find((c) => c.creator === 'Ruby Chen').cost_cents === 9500, 'a cancelled deal costs only the product');
  assert(run('results all', C('results')).length === 4, 'four live or wrapped campaigns');
  const gifting = run('gifting', C('gifting'));
  assert(gifting.summary.gifts === 8 && gifting.summary.posted === 3, 'three of eight gifts posted');
  const rights = run('rights', C('rights'));
  assert(rights.find((r) => r.collab === 'K-1009').state.startsWith('BREACH') && rights.find((r) => r.collab === 'K-1010').state === 'ending soon', 'rights states');
  assert(run('spend', C('spend')).length === 3, 'spend per brand');
  assert(run('campaigns', C('campaigns')).length === 4 && run('campaigns --all', C('campaigns', '--all')).length === 5, 'campaign lists');
  const cp1 = run('campaign card', C('campaign', 'summer'));
  assert(cp1.roster.length === 4 && cp1.deliverables.length === 4, 'Summer SPF roster and deliverables');
  assert(run('collabs', C('collabs')).length === 9 && run('collabs --all', C('collabs', '--all')).length === 13, 'collab lists');
  assert(run('creators', C('creators')).length === 11 && run('creators --all', C('creators', '--all')).length === 12, 'Ruby is hidden unless --all');
  assert(run('creators by niche', C('creators', '--niche=skin')).length === 2, 'two skincare creators');
  const card = run('creator card by handle', C('creator', '@aroha.glows'));
  assert(card.code === 'CR-01' && card.collaborations.length === 2 && card.handles.length === 2, 'Aroha card');
  const short = run('shortlist', C('shortlist', 'CP-01', '--niche=skin'));
  assert(short.length === 1 && short[0].code === 'CR-07', 'Hana is the one skincare creator not on Summer SPF');
  assert(run('shortlist AU', C('shortlist', 'CP-03')).every((s) => s.country === 'AU'), 'an Australian campaign shortlists Australian creators');
  run('brands', C('brands'));
  refused('ambiguous creator', C('creator', 'a'), /More than one creator/);

  // ---- the gates
  refused('a vitamin testimonial cannot be approved', C('approve', 'P-2008'), /24\(4\)/);
  run('Mia sends her TikTok draft', C('draft', 'P-2004', '--note=Bathroom shelf routine'));
  refused('approve without terms', C('approve', 'P-2004'), /no signed terms/);
  refused('do not use', C('invite', 'CP-01', 'Ruby Chen'), /do not use/);
  refused('paused', C('invite', 'CP-05', 'Zoe Martin'), /paused/);
  refused('already on the campaign', C('invite', 'CP-01', 'CR-01'), /already on CP-01/);
  refused('ad past its rights', C('ad', 'P-2010', 'on'), /ended/);
  refused('pay more than owed', C('paid', 'K-1001', '--amount=2000'), /more than/);
  refused('product before yes', C('ship', 'K-1012', '--product=Kit', '--value=50'), /said yes/);

  // ---- clearing the breaches
  run('ad off', C('ad', 'P-2010', 'off'));
  run('Jack moves the label upfront', C('posted', 'P-2005', '--label=#ad'));
  run('terms signed for Mia', C('agreement', 'K-1003', '--signed=today', '--rights=90', '--scope=organic social, NZ'));
  run('terms signed for Tom', C('agreement', 'K-1005', '--signed=today'));
  run('Ella re-cuts as an endorsement', C('draft', 'P-2008', '--testimonial=no', '--note=What is in the range, no results'));
  assert(run('approve the re-cut', C('approve', 'P-2008', '--by=Dana Reid')).approved, 'endorsement approved');
  run('approve Mia now terms are signed', C('approve', 'P-2004'));
  run('Grace re-cuts her live reel', C('posted', 'P-2009', '--testimonial=no'));
  assert(run('pay Aroha', C('paid', 'K-1001', '--ref=INV-AN-118', '--method=bank transfer')).still_owed_cents === 0, 'Aroha paid in full');
  run('gift arrives', C('delivered', 'G-303'));
  const comp2 = counts(run('compliance after fixes', C('compliance')));
  assert(Object.values(comp2).every((v) => v === 0), `all clear ${JSON.stringify(comp2)}`);
  assert(!run('owed after paying', C('owed')).some((o) => o.state === 'OVERDUE'), 'nothing overdue');

  // ---- a new creator, start to finish
  const added = run('add creator', C('add-creator', '--name=Ana Lemalu', '--handle=@ana.lemalu', '--platform=tiktok', '--followers=18.5k', '--er=6.2', '--email=ana@example.com', '--niche=skincare', '--rate=650'));
  assert(added.code === 'CR-13', 'next creator code');
  refused('duplicate handle', C('add-creator', '--name=Someone', '--handle=@ana.lemalu', '--platform=tiktok'), /already/);
  run('second handle', C('handle', 'Ana Lemalu', '--platform=instagram', '--handle=@analemalu', '--followers=6200'));
  const cpNew = run('new campaign', C('campaign-add', '--brand=TF', '--name=Autumn Repair', '--kind=paid', '--starts=+30', '--ends=+60', '--budget=5000', '--prefix=REPAIR'));
  assert(cpNew.code === 'CP-06', 'next campaign code');
  const vit = run('therapeutic campaign warns', C('campaign-add', '--brand=KV', '--name=Spring Energy', '--kind=paid', '--starts=+60', '--ends=+90'));
  assert(/24\(4\)/.test(vit.warning), 'therapeutic warning');
  run('campaign live', C('campaign-status', 'CP-06', 'live'));
  const inv = run('invite', C('invite', 'CP-06', 'Ana Lemalu', '--deliverables=tiktok:+10,story:+10'));
  assert(inv.code === 'K-1014' && inv.fee_cents === 65000 && inv.deliverables.length === 2 && inv.discount_code === 'REPAIR-ANA', `invite ${JSON.stringify(inv)}`);
  run('log the DM', C('log', 'K-1014', 'Sent the invite by DM', '--kind=dm'));
  run('accept', C('accept', 'K-1014'));
  const ship = run('ship before terms warns', C('ship', 'K-1014', '--product=Repair kit', '--value=80', '--courier=NZ Post', '--tracking=NZ1'));
  assert(/no signed terms/.test(ship.warning), 'shipping without terms warns');
  run('terms', C('agreement', 'K-1014', '--signed=today', '--rights=60', '--whitelisting'));
  refused('approve before a draft', C('approve', 'P-2013'), /No draft/);
  run('draft', C('draft', 'P-2013'));
  run('approve', C('approve', 'P-2013'));
  const bad = run('posted with no label is recorded and flagged', C('posted', 'P-2013', '--url=https://www.tiktok.com/@ana.lemalu/video/1'));
  assert(!bad.disclosure_ok && counts(run('compliance flags it', C('compliance'))).disclosure === 1, 'missing label is a breach');
  assert(run('posted with the label', C('posted', 'P-2013', '--label=#ad')).disclosure_ok, 'label fixes it');
  run('story up', C('posted', 'P-2014', '--url=https://www.tiktok.com/@ana.lemalu/story/1', '--label=Ad'));
  run('numbers', C('metrics', 'P-2013', '--views=12.4k', '--likes=900', '--comments=40', '--shares=55', '--saves=210', '--clicks=300', '--code-uses=19', '--sales=1520'));
  assert(run('ad on inside rights', C('ad', 'P-2013', 'on')).ad_running, 'whitelisted ad on');
  const owedAna = run('owed after posting', C('owed')).find((o) => o.collab === 'K-1014');
  assert(owedAna.due_on && owedAna.state === 'due', 'fee falls due 14 days after the last post');
  run('invoice', C('invoice', 'K-1014', '--ref=AL-001'));
  run('paid', C('paid', 'K-1014'));
  assert(run('collab complete', C('collabs', '--all')).find((k) => k.code === 'K-1014').stage === 'complete', 'posted and paid is complete');
  assert(run('leaderboard has Ana', C('leaderboard')).some((b) => b.code === 'CR-13'), 'Ana on the leaderboard');
  run('decline the quiet invite', C('decline', 'K-1012', '--reason=no reply'));
  run('status', C('status', 'Liam', 'prospect'));
  refused('pausing needs a reason', C('status', 'Hana', 'paused'), /reason/);

  // ---- import and export
  const csv = path.join(dataDir, 'grin-export.csv');
  writeFileSync(csv, [
    'Creator ID,First Name,Last Name,Email,Instagram Handle,Instagram Followers,TikTok Handle,TikTok Followers,Country,City,Stage,Tags',
    'g-881,Hana,Kim,hana@hanaskinlab.example,hanaskinlab,9800,,,NZ,Auckland,Contacted,skincare',
    'g-882,Wiremu,Tane,wiremu@example.com,wiremu.outdoors,27100,@wiremutane,40200,NZ,Rotorua,Active,outdoors',
    'g-883,Not,Aroha,someone@example.com,,,@aroha.glows,1000,NZ,,Prospect,',
    'g-884,,,,,,,,NZ,,,',
  ].join('\r\n') + '\r\n');
  const dry = run('import dry run', C('import', 'grin', csv, '--dry-run'));
  assert(dry.created === 1 && dry.updated === 1 && dry.dry_run, `dry run ${JSON.stringify(dry)}`);
  assert(run('dry run saved nothing', C('creators', '--all')).length === 13, 'still 13');
  const imp = run('import', C('import', 'grin', csv));
  assert(imp.created === 1 && imp.updated === 1 && imp.skipped.length === 2 && /CR-01/.test(imp.skipped[0].why), `import ${JSON.stringify(imp)}`);
  const again = run('import again', C('import', 'grin', csv));
  assert(again.created === 0 && again.updated === 2, 'a second import creates nothing');
  assert(run('Wiremu has two handles', C('creator', 'Wiremu Tane')).handles.length === 2, 'both handles');
  const mcsv = path.join(dataDir, 'metrics.csv');
  writeFileSync(mcsv, 'Deliverable,Date,Views,Likes,Comments,Shares,Saves,Link Clicks,Code Uses,Sales\nP-2002,today,8800,0,0,0,0,140,6,480\nP-9999,today,1,1,1,1,1,1,1,1\n');
  const mi = run('import metrics', C('import', 'metrics', mcsv));
  assert(mi.recorded === 1 && mi.skipped.length === 1, 'story numbers imported');
  const exp = run('export', C('export', `--out=${path.join(dataDir, 'export')}`));
  assert(exp.tables.creators === 14 && existsSync(path.join(dataDir, 'export', 'deliverables.csv')), 'export');

  // ---- views and documents
  run('views', ['view.mjs'], { json: false });
  assert(readdirSync(path.join(outDir, 'views')).length === 3, 'three views');
  run('documents', ['docs.mjs'], { json: false });
  for (const d of ['collaboration-terms', 'campaign-report', 'payment-advice']) assert(readdirSync(path.join(outDir, 'docs-out', d)).length > 0, `${d} rendered`);
  run('help', ['creators.mjs', 'help'], { json: false });

  console.log(`\nPASS: ${step} steps`);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
