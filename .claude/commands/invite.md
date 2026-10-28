---
description: Put a creator on a campaign with their fee and deliverables, then draft the invite. Refuses creators marked do not use or paused.
---

1. Run `node scripts/creators.mjs invite <campaign> <creator> --fee=... --deliverables="reel:+14,story:+14" --json`. Without `--fee` it uses their usual rate (zero on a gifting campaign). It sets their discount code from the campaign prefix.
2. If it refuses, say why in one line (do not use, paused, already on the campaign).
3. Run `/draft-outreach` for the new collaboration code.
4. When they answer: `accept K-xxxx` or `decline K-xxxx --reason="..."`. On accept, the next step is always the brief and terms: `/draft-brief K-xxxx`.
