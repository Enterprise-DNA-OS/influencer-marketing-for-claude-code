---
description: Set up a campaign for a brand: dates, budget, kind, brief, the ad label every post must carry, and the discount code prefix.
---

1. Collect brand, name, kind (paid, gifting, affiliate, ugc, ambassador), start and end, budget, brief, hashtag, discount prefix, owner. The label defaults to `#ad`.
2. If the brand is new, add it first: `brand-add <CODE> --name="..." --category=general|cosmetic|food|alcohol|therapeutic|financial --market=NZ|AU|NZ+AU`.
3. Run `node scripts/creators.mjs campaign-add --brand=... --name="..." --kind=... --starts=... --ends=... --budget=... --brief="..." --prefix=... --owner=... --json`. Read out any warning (therapeutic goods in Australia).
4. When it starts: `campaign-status <code> live`. Offer `/shortlist` next.
