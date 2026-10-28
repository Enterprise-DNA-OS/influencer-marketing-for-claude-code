#!/usr/bin/env node
// Loads supabase/seed.sql: Harbour & Co, a fictional Auckland agency running creator programmes for a
// skincare brand, a coffee roaster and a vitamin brand sold in Australia. Twelve creators, five
// campaigns, thirteen collaborations in every state. Dates are relative to today and every insert
// skips what is already there, so re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
  const [c] = await db.query(`
    select (select count(*) from brands) as brands, (select count(*) from creators) as creators, (select count(*) from creator_handles) as handles,
           (select count(*) from campaigns) as campaigns, (select count(*) from collaborations) as collaborations, (select count(*) from gifts) as gifts,
           (select count(*) from deliverables) as deliverables, (select count(*) from post_metrics) as metrics, (select count(*) from payments) as payments,
           (select count(*) from activities) as activities`);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const db = await getDb();
  try {
    const n = await seed(db);
    console.log(`seed: ${n.brands} brands, ${n.creators} creators (${n.handles} handles), ${n.campaigns} campaigns, ${n.collaborations} collaborations, ${n.gifts} gifts, ${n.deliverables} deliverables, ${n.metrics} metric captures, ${n.payments} payments, ${n.activities} activities`);
  } finally {
    await db.close();
  }
}
