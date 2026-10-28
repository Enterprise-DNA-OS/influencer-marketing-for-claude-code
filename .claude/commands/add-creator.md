---
description: Add a creator you found (from a search, a DM, an agent's roster) with their handles and numbers, without creating a duplicate.
---

1. Collect name, main handle and platform, followers, engagement rate if known, email, niche, country, usual rate. Ask only for what is missing and needed.
2. Run `node scripts/creators.mjs add-creator --name="..." --handle=@... --platform=instagram --followers=... --er=... --email=... --niche=... --rate=... --json`. It refuses a handle or email already on file and names who has it.
3. Add more handles with `handle <creator> --platform=tiktok --handle=@... --followers=...`.
4. Confirm the new code in one line and offer `shortlist` for a campaign they would suit.
