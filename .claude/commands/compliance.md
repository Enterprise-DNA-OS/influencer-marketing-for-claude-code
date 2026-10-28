---
description: Check the programme against the advertising rules creators and brands work under (ad labels upfront, no paid testimonials for therapeutic goods in Australia, signed terms before product or content, reuse inside usage rights) and report breaches with the rule cited.
---

1. Read `docs/compliance.md`. Each rule has its source, what a breach looks like in the data, and where the CLI already refuses at the gate.
2. Run `node scripts/creators.mjs compliance --json` (add a rule name to run one: disclosure, therapeutic, agreement, rights).
3. Report as a table: rule, count, the worst example, the source. Breached first, clean last.
4. For anything breached, draft the fix the operator can approve: a caption fix request to the creator, a re-cut request, the terms to sign, the ad to pause today. Drafts go to `drafts/`, never sent from here. Never edit history to make a breach disappear: record the fixed post when it is fixed.
5. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal advice. The doc records the rules the operator has told the system to enforce, with sources, and this command checks the data against them.
