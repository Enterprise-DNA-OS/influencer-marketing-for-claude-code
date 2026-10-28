---
description: Record the numbers a post earned from the creator's insights (views, reach, likes, comments, shares, saves, link clicks, code uses, sales).
---

1. Get the numbers from the creator's insights screenshot or export, or the discount code report from your store.
2. Run `node scripts/creators.mjs metrics P-xxxx --views=... --reach=... --likes=... --comments=... --shares=... --saves=... --clicks=... --code-uses=... --sales=... --source="insights screenshot" --json`. `12.4k` is fine.
3. For a batch, put them in a CSV with a Deliverable or URL column and run `import metrics <file> --dry-run`, then for real.
4. Each capture is kept; the latest one counts. Never type numbers you were not given.
