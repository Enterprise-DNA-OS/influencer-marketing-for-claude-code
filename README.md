<h1 align="center">Influencer Marketing for Claude Code</h1>

<p align="center">
  <strong>The open-source influencer marketing system (creators, campaigns, gifting, deliverables, content rights and disclosure checks) that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your GRIN data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=grin">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/grin?utm_source=github&utm_medium=readme&utm_campaign=grin">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-grin">Instead of GRIN</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Influencer Marketing for Claude Code does the job you pay GRIN for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the GRIN dashboard cannot.

GRIN's own pricing page lists Scale at US$1,500 a month, which is US$18,000 a year, plus a 5 per cent management fee on every dollar you put in the wallet that pays creators; Starter is US$200 a month plus 10 per cent, and Enterprise is a custom annual agreement (grin.co/pricing, checked 28 October 2026). The fee grows with the money you send creators, so the bill grows as the programme works.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=grin).

It covers a creator programme from the first message to the last payment: the creators and their handles, campaigns and budgets, each deal with its fee, signed terms, usage rights and discount code, product sent as gifts, every deliverable from draft to approved to posted with its ad label, the numbers each post earned, and the fees owed. It checks the advertising rules that New Zealand and Australian brands work under. It is for brands and agencies in New Zealand and Australia running anywhere from ten to a few hundred creators a year. Finding new creators on the networks stays with the networks: you add the ones you find.

### Ten questions it answers that the dashboard does not

1. Which posts went up with no ad label, or with #ad buried after the other hashtags? (`compliance disclosure`)
2. Which vitamin or supplement posts in Australia are testimonials from creators we paid or gifted? (`compliance therapeutic`)
3. Which creators have our product but never signed terms telling them how to label it? (`compliance agreement`)
4. Which creator content is still running as an ad after its usage rights ended, and whose rights end this month? (`rights`)
5. What did one engagement actually cost from each creator, across every campaign, fees and product together? (`leaderboard`)
6. Which gifts turned into a post, and who has kept product without posting? (`gifting`)
7. Who is owed money, on which invoice, and how late are we? (`owed`)
8. What did each campaign return in tracked sales for every dollar spent, by creator? (`results`)
9. Who should we invite next: in this niche and market, not already on the campaign, best engagement, never late before? (`shortlist`)
10. Which invites and first messages went quiet, and which posts have no numbers yet? (`attention`)

### Your first hour: ten things to ask for

1. "Set up our three brands: Tide & Fern (skincare, NZ), Southern Roast (coffee, NZ) and Kowhai Vitamins (therapeutic, sold in Australia)."
2. "Import our creators from the GRIN export in Downloads, dry run first."
3. "Set up the Summer SPF campaign: 20 November to 20 December, $12,000, label #ad, codes start SPF."
4. "Who should we invite? Skincare, Instagram, over 10k followers."
5. "Invite Aroha for one reel and two story frames at $900, due in two weeks."
6. "Draft the brief and terms for Aroha."
7. "Aroha's draft came in. It is fine, approve it."
8. "It is live, here is the link, the caption starts with #ad."
9. "Give me the Monday programme meeting."
10. "Add a field for the creator's audience split by country." (`/customise`)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/influencer-marketing-for-claude-code.git
cd influencer-marketing-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`, or just ask "which posts are late, and who still needs paying?"

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that needs a person now, breaches first |
| `/due` | Content late, waiting for approval, or due soon |
| `/creators` | The roster by status, niche, platform or country |
| `/creator` | The whole story of one creator |
| `/add-creator` | Add a creator and their handles, no duplicates |
| `/shortlist` | Who to invite to a campaign, best engagement first |
| `/campaigns` | Live and planned campaigns against budget |
| `/campaign` | One campaign: brief, roster, deliverables |
| `/new-campaign` | Set up a campaign and its ad label |
| `/invite` | Put a creator on a campaign with fee and deliverables |
| `/agreement` | Record signed terms, usage rights, whitelisting |
| `/ship` | Product sent and delivered |
| `/content` | Draft, approve and posted, with the label checked |
| `/metrics` | The numbers a post earned |
| `/owed` | Fees owed and when they fall due |
| `/gifting` | Which gifts turned into posts |
| `/rights` | Usage rights and content running as ads |
| `/results` | What a campaign cost and earned, by creator |
| `/leaderboard` | Every creator on cost per engagement and sales |
| `/spend` | Budget, committed and paid per brand |
| `/log` | Record an email, DM, call or meeting |
| `/draft-outreach` | An invite or one follow-up, to `drafts/` |
| `/draft-brief` | The brief and terms with a covering note, to `drafts/` |
| `/draft-chasers` | Chasers for late content, numbers and caption fixes, to `drafts/` |
| `/compliance` | The records against four rules, each with its source |
| `/weekly-review` | The Monday programme meeting from four commands |
| `/import` | Creators from GRIN and numbers from insights, dry run first |
| `/customise` | Change a field, a stage or a rule in plain words |
| `/new-view` | A new read-only page for `npm run view` |

`npm run view` renders the today, campaigns and creators pages as HTML in your brand (`brand.json`). `npm run docs` renders the collaboration brief and terms, the campaign report and the payment advice for every record.

## Instead of GRIN

Export your creators (with contact emails) from GRIN before you cancel, then:

```bash
npm run creators -- import grin creators.csv --dry-run
npm run creators -- import grin creators.csv
```

The importer reads common column names, reports every row it cannot place, and remembers GRIN ids, emails and handles so a second run creates nothing. What maps and what does not carry over: [docs/replace-grin.md](docs/replace-grin.md). The rules the system checks, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
influencer-marketing-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Influencer Marketing for Claude Code for your business, migrates your GRIN data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=grin)
- Read more: [enterprisedna.co/omni/instead-of/grin](https://enterprisedna.co/omni/instead-of/grin?utm_source=github&utm_medium=readme&utm_campaign=grin)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
