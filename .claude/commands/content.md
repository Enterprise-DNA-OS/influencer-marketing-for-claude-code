---
description: Move a deliverable through draft, approval and posted, with its ad label checked. Refuses to approve a paid testimonial for therapeutic goods in Australia, or anything without signed terms.
---

The operator says a draft came in, they approve it, or it is live.

1. Draft in: `node scripts/creators.mjs draft P-xxxx --note="what it shows" [--testimonial=yes|no] --json`. A testimonial is the creator describing their own experience or results with the product. Ask if unsure.
2. Approve: `approve P-xxxx --by="..." --json`. If it refuses, read the reason out. For a therapeutic goods testimonial the fix is a re-cut as an endorsement (what the product is, why they keep it, no personal results), recorded with `draft P-xxxx --testimonial=no`. There is no override.
3. Live: `posted P-xxxx --url=... --label="#ad" --json`. Add `--end` if the label is not at the start of the caption. It records the post either way, because the post is already live, and reports any breach.
4. For a breach, draft a short message to the creator asking them to fix the caption today, to `drafts/`. Record the fixed post with `posted` again.
