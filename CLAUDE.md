# Influencer Marketing for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing today, what is broken | `/attention` |
| What content is late or waiting for approval | `/due` |
| Who is on the roster, by niche or platform | `/creators` |
| Everything about one creator | `/creator` |
| A new creator they found | `/add-creator` |
| Who to invite to a campaign | `/shortlist` |
| Live campaigns, budgets | `/campaigns` |
| One campaign in full | `/campaign` |
| A new campaign or brand | `/new-campaign` |
| Put a creator on a campaign | `/invite` |
| Signed terms, usage rights, whitelisting | `/agreement` |
| Product sent or arrived | `/ship` |
| A draft came in, approve it, it is live | `/content` |
| The numbers from a post | `/metrics` |
| Who is owed money | `/owed` |
| Did the gifting work | `/gifting` |
| Usage rights, ads from creator content | `/rights` |
| How a campaign did | `/results` |
| Which creators are worth it | `/leaderboard` |
| Spend per brand | `/spend` |
| Record a message or call | `/log` |
| Write an invite or follow-up | `/draft-outreach` |
| Send the brief and terms | `/draft-brief` |
| Chase late content or numbers | `/draft-chasers` |
| Are we within the advertising rules | `/compliance` |
| The Monday meeting | `/weekly-review` |
| Bring data from GRIN or a spreadsheet | `/import` |
| Change a field, a stage or a rule | `/customise` |
| A new page to look at | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run creators -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never pay anyone from here. `paid` records a payment made in the bank; it moves no money.
- Never type post numbers you were not given. Numbers come from the creator's insights, an export or the store's code report.
- The advertising rules in `docs/compliance.md` are gates, not suggestions. `approve` refuses a paid testimonial for therapeutic goods in Australia and anything without signed terms; there is no override flag, and you never add one.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off GRIN.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/grin
