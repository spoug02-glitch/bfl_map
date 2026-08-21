# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`README.md` covers env vars and the Kakao/Vercel console setup — read it for those. This file
covers what you cannot discover by reading one file, and the traps that have actually cost time.

## Commands

```bash
# web (Next.js). Run from Bfl_map/web
npx tsc --noEmit                 # types
npm run lint                     # eslint
npx vitest run                   # 353 tests
npx vitest run __tests__/price.test.ts          # one file
npx vitest run -t "DB 메뉴"                      # tests whose name matches
npm run build                    # prebuild regenerates lib/share-index.json

# collector (Python). Run from Bfl_map/collector
python -m pytest tests/ -q       # 84 tests
python collect.py                # full re-collect, hours; resumes from .checkpoint.jsonl

# mcp. Run from Bfl_map/mcp
python -m pytest tests/ -q       # 4 tests
```

**A fresh worktree has no `web/.env.local`,** so `npm run build` dies at page-data collection.
Dummy values get you a full build:

```bash
DATABASE_URL="postgres://u:p@localhost:5432/db" ADMIN_SESSION_SECRET="x" SESSION_SECRET="x" npm run build
```

**Stop the dev server before running vitest.** With one running, the API route tests lose their
5s budget to CPU contention and about 16 of them fail. They are not flaky; the machine is busy.
For the same reason, never `rm -rf .next` while a dev server is up — it serves 500s afterwards.

## Deploying

Vercel watches a **separate repository**, not this monorepo:

```bash
git -C <worktree> subtree push --prefix=Bfl_map bflmap main
```

**Vercel's Redeploy button does not pick up new code.** It rebuilds whatever commit `bflmap/main`
already points at. When a deploy looks wrong, check `git log --oneline -3 bflmap/main` before you
suspect env vars — a whole feature once sat unpushed while Redeploy was pressed repeatedly.
`/privacy`'s 최종 수정일 is a handy visible marker for which build is live.

**Run DB migrations before pushing code.** New code against an old schema 500s.

## Where data lives

Two homes, and the split is the thing to understand:

- **`web/public/restaurants.json`** — 5,834 places. Owned by the collector, rewritten whole on
  every run, served publicly with no auth. Anything here is a public 2.6MB download.
- **Neon Postgres** — everything that changes at runtime: reviews, saved places, `menu_items`,
  `reports`, `visits`, admin accounts.

They join on `kakao_place_id` only. `saved_places`/`reviews` deliberately have no FK to places,
because places are not in the database.

Because the collector rewrites the JSON wholesale, **you cannot partially preserve anything in
it** — that is why menus moved to Postgres rather than staying a field on each place.

## Menu provenance

Menus were scraped from an unofficial Kakao endpoint until 2026-08-18, when the owner stopped it
on copyright grounds. `collector/menu.py` and the MCP `get_menu` tool are gone; do not bring them
back. Every menu now lives in `menu_items` with an explicit source.

- `source_type`: `public_data` | `owner` | `user_report` | `official_source` | `legacy_import`
- `status`: `pending` | `published` | `rejected`

**`dbMinPrice` counts only `published` rows**, so an unreviewed submission cannot pull a place
through the price filter. That single rule is why the whole status column exists — preserve it.

`effectiveMinPrice(special, dbItems?)` in `lib/constants.ts` decides what the price filter sees.
It is the load-bearing consumer of menu data: with menus gone it covers 53 of 5,109 places, which
is the app's biggest open problem.

**`menu_items` has no notion of a side dish.** Loading 공기밥 1,000원 makes an 11,000원 ramen shop
pass a "5천원 이하" filter, so imports currently exclude sides, drinks and add-ons by hand. This
will bite again when shop owners submit their own full menus.

Sources feeding it today:
- `web/scripts/import-goodprice.mjs` — 행정안전부 착한가격업소 CSV, quarterly, manual download.
  **The CSV is EUC-KR**; reading it as UTF-8 silently yields zero matches rather than an error.
- `/owner` and `/report` — public forms, no login, nothing publishes without admin approval.

## Schema drift

`web/schema.sql` and `web/migrations/*.sql` must both be updated. This repo has been bitten three
times: a database built from `schema.sql` came up missing `saved_places`, `lunch_specials` and
`withdrawals`, silently losing their constraints. After adding a table, verify:

```bash
comm -13 <(grep -oiE 'CREATE TABLE (IF NOT EXISTS )?[a-z_]+' schema.sql | grep -oiE '[a-z_]+$' | sort -u) \
         <(grep -hoiE 'CREATE TABLE (IF NOT EXISTS )?[a-z_]+' migrations/*.sql | grep -oiE '[a-z_]+$' | sort -u)
```

Empty output means they agree. `reviews` and `visits` predate `migrations/`, so schema-only is
normal for those two.

## Two Kakao surfaces, three key types

Official and licensed: the Local search API (`dapi.kakao.com`, collector place matching), the map
SDK, OAuth login, the share SDK. These stay.

The JavaScript key, the REST key and the admin key are different keys with **separate** allow-lists
in the console. Filling one does not configure the others, and the failure is silent — see the
console checklist in `README.md`.

## Committing here

A `git-guard.sh` PreToolUse hook blocks commits from the primary checkout, `main`,
`integration/apps-clean`, and retired branches. It only inspects **Bash** commands and it honours
`git -C <path>`:

- Use `git -C "<worktree>" commit …`. A `cd … && git commit` is judged against the session's
  directory and denied.
- `git add` and `git commit` must be **separate** Bash calls — the hook reads the index before your
  command runs, so a combined one sees an empty index.
- PowerShell is not inspected, which is a useful escape hatch for long commit messages
  (`git -C $w commit -F <file>`; here-strings break on quotes in the body).

Never touch `C:\Users\notebook\Desktop\Apps\Bfl_map` — that is a separate shared checkout.

## Writing code here

Comments in this codebase explain **why**, usually citing the incident that forced the choice, and
they are in Korean. Match that. A comment restating the code is worse than none; a comment naming
the bug that a line prevents is what stops the next person from "simplifying" it away.

Korean-text files must be edited with Read/Edit/Write or `sed` — PowerShell's text pipeline
defaults to CP949 and corrupts them irreversibly.

Fixed points, each with a reason recorded nearby: Kakao brand yellow `#fee500`, the Pretendard
font stack, 44px touch targets (`h-11`, `md:h-9`), every `prefers-reduced-motion` branch, and the
`color-scheme: light` declaration.

## Design docs

`docs/specs/` holds design decisions and `docs/plans/` the implementation plans. They record
rejected alternatives, so read the spec before changing behaviour it describes — several
"obvious" simplifications are things that were tried and reverted.
