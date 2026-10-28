---
description: Draft polite chasers for late content, missing insights and a fixed caption, one per creator. Drafts to drafts/, never sends.
---

1. Run `node scripts/creators.mjs attention --json` and keep the late content, numbers and disclosure items.
2. For each creator, one short message covering what is outstanding: the deliverable and its due date, the numbers you need (views, reach, saves, link clicks), or the caption fix (the label at the start). Facts from the record only. Use their agent's email when they have one.
3. Write to `drafts/chaser-<creator code>.md`. A person sends it and logs it: `log <creator> "Chased the reel" --kind=email`.
