---
description: Draft a first invite, or one follow-up to an invite that went quiet, for a creator. Drafts to drafts/, never sends.
---

1. Run `node scripts/creators.mjs creator <creator> --json` and `campaign <campaign> --json`.
2. Write a short, specific message: why them (one real thing from their content or numbers on record), what the campaign is, what you are asking for (deliverables and dates), the fee or the product, and that it will be labelled as an ad. No pressure lines. For a follow-up, one short note that refers to the first.
3. For therapeutic goods in Australia, say it is an endorsement: what the product is and why they would keep it, no personal results.
4. Write to `drafts/outreach-<code>.md` with the email or handle at the top. A person sends it, then logs it: `log K-xxxx "Sent invite" --kind=dm`.
