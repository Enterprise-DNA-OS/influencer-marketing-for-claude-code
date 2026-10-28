---
description: Fees owed to creators: what, to whom, the invoice, and when it falls due or how late it is.
---

1. Run `node scripts/creators.mjs owed --json`.
2. Present overdue first (days late, invoice reference), then dated, then not due until posted. Total per currency.
3. Once paid in your bank: `paid K-xxxx --ref=... --method="bank transfer"`. An invoice that has come in but is not paid: `invoice K-xxxx --amount=... --due=... --ref=...`.
4. Nothing here moves money. It is the record of what is owed.
