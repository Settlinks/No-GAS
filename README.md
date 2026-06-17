# Catalog Platform

A product catalog you can resell to small businesses that don't have a website — built entirely on free tiers: **Supabase** (database, auth, file storage) and **GitHub Pages** (hosting). No build step, no framework, no server to maintain. Plain HTML/CSS/JS that anyone can open and edit directly.

It replaces a Google-Apps-Script-based catalog with something that scales to many client businesses without paying for anything or juggling separate backend projects per client.

## How it scales to many clients for free

The trap most "free tier" plans set is per-project limits (Supabase caps you at 2 free projects per organization). This avoids that entirely: **one Supabase project and one GitHub Pages deployment serve every client.** Each business is a row in a `stores` table, not a separate deployment.

- Onboarding a new client = inserting one row in a table, not redeploying anything.
- Each store has its own slug, colors, logo, language, currency, and contact method.
- A storefront URL looks like `yoursite.com/?store=panaderia-lupe`. If a client wants their own dedicated domain instead, the same codebase supports that too (see `config.js`).
- Row Level Security in Postgres keeps every store's data isolated — the public can only ever see active stores and visible products; an owner can only ever touch their own store.

## What's included

- **Public storefront** (`index.html`, `catalog.css`, `catalog.js`) — search, filters that auto-hide when a business doesn't use that field (e.g. no "brand" filter for a bakery), an animated banner, a product detail modal, native share, and a WhatsApp/email inquiry cart so shoppers can ask about several items in one message. There's no checkout — these are inquiry catalogs, which matches how small businesses without a website actually sell.
- **Admin app** (`admin/`) — a login-protected dashboard so the business owner manages their own products, categories, theme, and contact info without ever touching Supabase or code. Includes photo upload with automatic client-side compression.
- **Database schema** (`supabase/schema.sql`) — the full multi-tenant table structure and Row Level Security policies, written to be safe to re-run.
- **Docs** (`docs/`) — step by step setup, deployment, client onboarding, and customization guides.

## File map

```
config.js                  ← the only file each deployment edits: Supabase URL + anon key
index.html / catalog.css / catalog.js   ← public storefront
admin/                      ← login, dashboard, product/category/theme management
shared/                     ← theme engine, Supabase client init, i18n + formatting helpers
supabase/schema.sql         ← run once in the Supabase SQL editor
supabase/seed-demo.sql      ← optional: see a working catalog immediately (?store=demo)
docs/                       ← setup, deployment, onboarding, and customization guides
```

## Quickstart

1. **`docs/01-supabase-setup.md`** — create a free Supabase project, run `supabase/schema.sql`.
2. **`docs/02-deploy-github-pages.md`** — put this repo on GitHub, fill in `config.js`, turn on Pages.
3. Optionally run `supabase/seed-demo.sql` and visit `yoursite.com/?store=demo` to see it working end to end before touching a real client.
4. **`docs/03-onboard-new-client.md`** — add your first real client.
5. **`docs/04-customize-theme-and-categories.md`** — adapt colors, fonts, and categories per business type.
6. **`docs/05-admin-guide-for-business-owners.md`** — hand this to the client; it's written for them, not for you.

## A note on what this is (and isn't)

There's no checkout, no payments, and no inventory beyond a simple in-stock/out-of-stock/preorder flag. That's intentional — it matches what a small business without a website actually needs: a place for customers to browse and then message them directly. If a client later needs real e-commerce, this isn't that tool.

It also hasn't been run against a live Supabase project as part of this build — the schema and queries were written carefully and cross-checked, but treat the first real deployment as your test pass, and start with the demo seed before inviting a paying client.
