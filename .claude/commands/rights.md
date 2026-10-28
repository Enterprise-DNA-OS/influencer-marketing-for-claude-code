---
description: Usage rights, whitelisting and creator content running as paid ads, with anything past or near its end date.
---

1. Run `node scripts/creators.mjs rights --json`.
2. Present breaches first (content running as an ad past its rights), then rights ending within the warning days, then the rest.
3. For a breach: the ad is paused today in the ad account, then `ad P-xxxx off`. If the brand wants to keep running it, draft a request to the creator to extend the rights (to `drafts/`) and record the new date with `agreement K-xxxx --rights-until=<date>`.
