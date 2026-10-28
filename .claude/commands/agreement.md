---
description: Record the signed brief and terms for a collaboration: signed date, usage rights and where they apply, whitelisting, exclusivity, fee changes.
---

1. Confirm the creator has signed the terms (the `collaboration-terms` document from `npm run docs`, or your own contract).
2. Run `node scripts/creators.mjs agreement K-xxxx --signed=today --ref="..." --rights=90 --scope="organic and paid social, NZ" [--whitelisting] [--exclusive-until=<date>] --json`.
3. Read back the signed date, the usage rights end date and whitelisting in one line. The terms are what tells the creator how to label the post; approvals are refused without them.
