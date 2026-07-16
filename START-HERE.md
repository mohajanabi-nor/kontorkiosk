# START-HERE.md — brief for Claude Code

Read this, then `README.md`. This file is about **what to do and what not to break**.

## What this is

A self-service ordering kiosk for Nordic Engros AS (food wholesaler, Oslo), running
on a **32" portrait touch panel** in the warehouse, for walk-in customers.

Next.js (App Router, TypeScript) → Shopify Admin GraphQL API → **draft orders**.
No payment. Staff pick the order and settle at the counter.

## Your job

1. `npm install` && `npm run build` — should pass clean.
2. Deploy to **Vercel** with the two env vars (below).
3. **Send one test order and confirm a draft appears in Shopify admin under
   Orders → Drafts, tagged `kiosk`.** This is the only test that proves the chain.

The user is the owner/developer (Mohammed). He builds his own internal tooling and
prefers direct, short answers. He is **not** comfortable in the terminal — do the
command-line work for him rather than handing him commands.

## Env vars

| Name | Value |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `nordic-engros.myshopify.com` (the *.myshopify.com one) |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_…` from a custom app with `read_products` + `write_draft_orders` |

Without a token the app **still runs in demo mode** (empty grid, UI works). So a
deploy can happen before the token exists.

## Status — be precise about this

| Thing | State |
|---|---|
| `npm run build` | ✅ passes |
| App serves, renders rail + search + attract | ✅ verified on localhost |
| `/api/categories` returns 43 categories | ✅ verified |
| Demo mode (no token) | ✅ verified |
| GraphQL queries themselves | ✅ verified against the live store via a Shopify connector — search by title/vendor/SKU works, `sortKey: INVENTORY_TOTAL` sorts out-of-stock last |
| **Live token path end-to-end** | ❌ **never run.** No token existed in the build environment. |
| **`draftOrderCreate`** | ❌ **never executed against the real store.** |

So: the queries are right and the app is right, but **the two have never met**.
If something breaks, `lib/shopify.ts` is the first place to look — specifically
`createDraftOrder`, which is the only untested write path.

## Do not regenerate

- **`lib/categories.ts`** — 43 categories with real Shopify collection GIDs, mirrored
  from the live webshop nav (nordicengros.com/collections/hovedside) and verified
  against the store. This is *the menu*. Edit entries, don't rebuild the file.
- **`app/Lockup.tsx`** and `public/logo-*.svg` — the logo, traced from the customer's
  real artwork (1.59% pixel delta from source). Do not redraw it. It is white + gold
  for dark backgrounds; black + gold variants are in `public/`.
- **`app/globals.css`** — ported from a design the user approved through ~9 rounds of
  iteration. Don't restyle it. `design-reference/approved-design-mockup.html` is that
  approved design, standalone and openable in a browser (with fake data). If you need
  to know how something should look or behave, open that file.

## Design decisions already settled (don't relitigate)

- **Prices are public.** The webshop hides them ("Logg inn for å se priser"); the
  kiosk deliberately shows them to everyone. The user decided this explicitly.
- **Quantity = kolli (cases).** Cart/qty-pad totals use the variant price. The card
  headline is the per-unit price (`kr 60,-/stk`) because that's what the printed
  catalogue shows. `product_type` holds the per-unit price in this store — that's not
  a bug, it's how the store is set up.
- **Out-of-stock: shown, dimmed, unclickable, sorted last.** Not hidden.
- **Negative stock → "Ikke på lager".** The store has genuinely negative inventory
  counts; never render a negative to a customer.
- **60-second idle** clears the cart → attract screen. Replaces a "Start på nytt"
  button the user removed. Don't remove it: a public kiosk must not hand the next
  customer the last one's basket.
- **Whole card is the tap target**, not the small `+`. Deliberate, for touch.

## Known data issues (the user's data, not bugs to fix in code)

- Inventory is unreliable: many products read `0`, some negative (oversold). Entire
  categories (e.g. Hortex juice, Aksam snacks) currently show as unavailable. The
  kiosk faithfully reports what Shopify says.
- Within a category, sorting in-stock-first happens **per loaded page** (Shopify
  can't sort a collection by inventory). So an out-of-stock item from page 1 can
  appear above an in-stock one from page 2. Search doesn't have this problem
  (`sortKey: INVENTORY_TOTAL` works on `products`). Fix only if it actually annoys.

## The panel

`KIOSK-SETUP.md` covers it: **Fully Kiosk Browser** (Android), portrait, fullscreen,
lockdown, boot-on-power. Fullscreen alone is not kiosk mode — a public screen needs
the lockdown, or customers swipe out to the Android home screen.

## Open questions for the user

- How high is the panel mounted? Card size and rail were tuned by guesswork; nobody
  has stood in front of the real thing yet.
- Sub-categories (Brus, Juice, Energidrikker, Te, Kaffe…) exist in `lib/categories.ts`
  as `hidden: true`. The rail is flat. Enable if he wants them.
