---
description: Draft the brief and terms for a collaboration (deliverables, dates, the ad label and where it goes, fee, usage rights, exclusivity) from the record. Drafts to drafts/, never sends.
---

1. Run `node scripts/creators.mjs collabs --all --json` and `campaign <campaign> --json` for the collaboration.
2. Run `npm run docs -- collaboration-terms` and open the file for this collaboration: that is the branded terms document.
3. Write a covering email to `drafts/brief-K-xxxx.md`: what is attached, the one rule about the label (at the start of the caption, on every post and story frame, gifted product too), the dates, and how to sign and return it.
4. Once it is signed: `agreement K-xxxx --signed=<date> --rights=<days>`.
