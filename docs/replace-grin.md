# Moving off GRIN

GRIN's pricing page lists creator list and contact email export on Starter and above; the Free plan has no export (grin.co/pricing, checked 28 October 2026). Export before you cancel.

## 1. Export from GRIN

- **Creators.** From the creator list in GRIN, export creators with their contact emails. Include every field you use: name, email, handles and follower counts per platform, country, city, stage, tags, address.
- **Your own records.** Download the content you have the rights to keep, and note each live collaboration's fee, usage rights end date and discount code. GRIN's export columns depend on the fields you pick, so check the file before you rely on it.
- **Numbers.** Post performance from GRIN's reports or the creators' own insights, as a CSV with a post URL column.

## 2. Bring it across

```bash
npm run creators -- import grin creators.csv --dry-run
npm run creators -- import grin creators.csv
npm run creators -- import grin creators.csv   # must create nothing
```

The importer reads common column names (Name, First Name and Last Name, Email, Instagram Handle, Instagram Followers, TikTok Handle, TikTok Followers, YouTube, Country, City, Stage, Tags, Address) and reports every row it cannot place. It matches an existing creator on the GRIN id, then email, then handle. A handle that belongs to a creator with a different email is never merged: the row is skipped and named.

Then set up each live campaign and collaboration (`campaign-add`, `invite`, `accept`, `agreement`) and load numbers with `import metrics metrics.csv`, matched on the post URL or a deliverable code.

## What maps

| GRIN | Here |
|---|---|
| Creator, contact details, address | `creators` |
| Social accounts and follower counts | `creator_handles` |
| Relationship stage | `creators.status` (active, contacted, prospect, do not use) |
| Campaigns and activations | `campaigns`, `collaborations` |
| Product seeding and shipments | `gifts` |
| Content and its performance | `deliverables`, `post_metrics` |
| Payments to creators | `payments` (a record; the money moves in your bank) |

## What does not carry over

- **Finding new creators.** GRIN's discovery search runs on its own index of social accounts. Here you add the creators you find, by hand or by import. Enterprise DNA can connect a discovery tool for you.
- **Automatic post tracking.** GRIN finds and tracks program posts itself. Here you record the post link and the numbers from insights, or import them.
- **The Shopify gifting store and creator wallet.** Product orders and payouts happen in your store and your bank, and are recorded here.
- **Message history inside GRIN.** Export what you need to keep; new contact is logged with `log`.
