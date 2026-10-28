---
description: Bring creators across from GRIN (or any creator spreadsheet), and post numbers from an insights export. Dry run first; nothing is merged on a guess.
---

1. Read `docs/replace-grin.md`: what to export from GRIN, which columns map, what does not carry over.
2. Creators: `node scripts/creators.mjs import grin creators.csv --dry-run --json`. Read every skipped row out loud. A handle that belongs to a creator with a different email is never merged; the operator decides.
3. Run it for real, then run it again: the second pass must create nothing (the GRIN id, email and handles are remembered). That is the idempotency check.
4. Numbers: `import metrics metrics.csv --dry-run`, matched on a Deliverable code or the post URL.
5. Present created, updated, skipped and why, then run `/creators` and `/attention`.
