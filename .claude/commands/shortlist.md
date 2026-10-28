---
description: Creators worth inviting to a campaign: not already on it, in the campaign's market, best engagement first, with what they cost last time and whether they posted late.
---

1. Run `node scripts/creators.mjs shortlist <campaign> --json`, adding `--niche=`, `--platform=` or `--min-followers=` from the operator's ask.
2. Present the top ten: creator, handle, followers, engagement rate, status, cost per engagement last time (or "new"), late posts before.
3. Recommend three with one reason each, from the data. A creator new to you is fine; say so.
4. Offer to invite them: `invite <campaign> <creator> --deliverables="reel:+14"`, then `/draft-outreach`.
