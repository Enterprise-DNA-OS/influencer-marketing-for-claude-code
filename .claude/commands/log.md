---
description: Record an email, DM, call or meeting with a creator or their agent, against the creator or one collaboration.
---

1. Run `node scripts/creators.mjs log <creator or K-xxxx> "what happened" --kind=email|dm|call|meeting|note [--in] --by=<you> --json`. `--in` is for their message to you.
2. A first message to a prospect moves them to contacted. Replies are what stop an invite showing as quiet in `/attention`.
