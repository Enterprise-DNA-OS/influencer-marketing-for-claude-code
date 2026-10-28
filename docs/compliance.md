# The rule book /compliance checks

Four rules, each with its source, what a breach looks like in the data, and where the CLI already refuses at the gate. `node scripts/creators.mjs compliance` runs them all; add a rule name to run one.

Nothing here is legal advice. It is the rule book the operator has pointed the system at, with sources, and the operator changes it to match their business. When a code or the law moves, update the rule and the check together.

## 1. `disclosure` - every paid or gifted post is labelled as an ad, upfront

In New Zealand, advertisements must be identified as such. Influencer content about a product or service, made in return for any payment or reward (free product included), is an ad. The label must be obvious, clear, prominent and upfront, separate from other hashtags and links, on every post and every story frame; a line in the creator's bio is not enough, and the advertiser, the agency and the creator are all responsible. **Source: Advertising Standards Code, Principle 2, Rule 2(a) (Identification); ASA "Influencers AdHelp Information on Identifying Ad Content" (asa.co.nz).**

In Australia, advertising must be clearly distinguishable as such. The Ad Standards Community Panel has found that sending a creator gifted product gives the brand a degree of control over the post, so the post is advertising, and that tagging the brand is not enough on its own to make it clearly distinguishable (case 0323-21). **Source: AANA Code of Ethics s 2.7; Ad Standards Community Panel determinations.**

Which labels count is the setting `disclosure_labels` (default `#ad, ad, advertisement, sponsored, paid partnership`). The operator sets it to match the guidance they follow.

Breach in the data: a posted deliverable with no label, a label not on the accepted list, or `label_upfront` not true. **Gate: `posted` records the post (it is already live) and reports the breach; the fix is recorded with `posted` again once the caption is changed. The terms document tells the creator the label and where it goes.**

## 2. `therapeutic` - no paid or gifted testimonials for therapeutic goods in Australia

An advertisement for therapeutic goods (vitamins, supplements, sunscreens regulated as therapeutic goods, and the rest) must not contain a testimonial from a person engaged in the production, marketing or supply of the goods. The Code's note says that includes influencers and anyone who received valuable consideration, and product counts. A disclosed, labelled testimonial is still banned. An endorsement (what the product is and why they use it, without describing their own experience or results) is allowed. **Source: Therapeutic Goods (Therapeutic Goods Advertising Code) Instrument 2021 s 24(4); TGA guidance "Applying the Advertising Code rules: testimonials and endorsements".**

Brands carry a `category` and a `market`. The rule applies when the category is `therapeutic` and the market includes AU.

Breach in the data: a posted deliverable marked `is_testimonial` on such a brand, from a creator who was paid or sent product. **Gate: `approve` refuses such a draft. No force flag. The fix is a re-cut as an endorsement, recorded with `draft <code> --testimonial=no`. `invite` and `campaign-add` warn on these brands.**

## 3. `agreement` - signed terms before product ships or content is due

The advertiser must take all practical steps to make sure a creator identifies ad content about the product they were given. The practical step this system records is signed terms that state the label and where it goes, before product is sent or content falls due. **Source: ASA influencer guidance ("advertisers need to take all practical steps to ensure influencers identify ad content"); AANA Code of Ethics s 2.7, under which the advertiser answers for the post.**

Breach in the data: an accepted or complete collaboration with no `agreement_signed_on`, where product has been sent, content is posted, or a deliverable is past due. **Gate: `approve` refuses without signed terms; `ship` warns.**

## 4. `rights` - content runs as an ad only inside the usage rights granted

A creator owns the copyright in the photos and videos they make unless the agreement transfers it. Reusing the content in your own ads, on your site or from their handle (whitelisting) is a licence the creator gives for a period and a place. Using it after the licence ends is using their work without permission. **Source: Copyright Act 1994 (NZ) s 16 (acts restricted by copyright) and s 29 (infringement); Copyright Act 1968 (Cth) s 36 (works) and s 101 (films and other subject matter); the usage rights clause in your terms.**

Breach in the data: a deliverable with `ad_running` and no `usage_rights_until`, or a date before today. **Gate: `ad <code> on` refuses with no rights or rights that have ended. `/attention` flags rights ending within `rights_warning_days` while content is running or whitelisted.**

## What this does not check

Alcohol, gambling, food for children, financial advice and health claims have their own codes in both countries (for example the ASA Code for Advertising and Promotion of Alcohol in New Zealand and the ABAC Responsible Alcohol Marketing Code in Australia). If a brand sells one of these, add the rule here with its source and ask Claude Code to add the check (`/customise`).
