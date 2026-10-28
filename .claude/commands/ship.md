---
description: Record product sent to a creator (gifting or with a paid deal) and mark it delivered when it arrives.
---

1. Run `node scripts/creators.mjs ship K-xxxx --product="..." --value=<cost to you> --courier=... --tracking=... --json`. It refuses if the creator has not said yes.
2. If it warns that the terms are not signed, say so: a gifted post is still an ad and must be labelled, and the terms are where the creator is told. Offer `/draft-brief`.
3. When it arrives: `delivered G-xxx`. `/attention` flags anything not delivered after the shipment days in settings.
