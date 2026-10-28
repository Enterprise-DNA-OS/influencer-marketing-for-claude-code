---
description: The Monday programme meeting, written from four commands: what needs a person, what is due, what is owed, and how the live campaigns are doing.
---

1. Run four commands, `--json` each: `node scripts/creators.mjs attention`, `due --days=7`, `owed`, `results`.
2. Write the review in four short sections, prose plus small tables, nothing invented:
   - **Fix today.** The breaches and anything rank 1, one action each.
   - **This week's content.** Late, waiting for approval, due in the next seven days.
   - **Money.** Fees overdue and due this week, per currency.
   - **Campaigns.** Each live campaign: cost against budget, posts up, cost per engagement, tracked sales.
3. End with at most five actions for the week, each one command or one message.
4. For paper, `npm run view` renders the today, campaigns and creators pages in your brand.
