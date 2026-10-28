---
description: What a campaign cost and earned: fees and product, views, engagements, code uses, tracked sales, per creator and per engagement.
---

1. Run `node scripts/creators.mjs results <campaign> --json` (no campaign: every live and wrapped one).
2. Present the headline (cost against budget, cost per engagement, tracked sales for every dollar spent), then the creator table ranked by sales then engagements.
3. Say which creators to bring back and which not, from the numbers, in at most three lines. Tracked sales are code uses and link sales the operator recorded; say so if the numbers are thin.
4. For a client-ready version, run `npm run docs -- campaign-report` and point at the file.
