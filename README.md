# Nordic Engros – Frysebestilling (kiosk)

Self-service ordering kiosk for the freezer. Customers browse frozen products,
build an order, and tap **Send bestilling**. The order becomes a **draft order**
in your Shopify admin, tagged `kiosk`, with the customer's name/number in the note.
No payment is taken — staff packs from the freezer and settles at the counter.

Built with Next.js (App Router). Same stack as your customs and packing apps.

---

## How it works

```
Tablet (Fully Kiosk Browser, fullscreen)
        │
        ▼
Next.js app  ──GET /api/products──►  Shopify Admin API  (frozen products + images)
        │
        └──POST /api/order────────►  Shopify draftOrderCreate  (tagged "kiosk")
                                            │
                                            ▼
                                     Shows up in your admin / packing flow
```

Three modes, depending on what you've configured:

| Config | Products from | Send bestilling |
|--------|---------------|-----------------|
| Nothing set | built-in frozen list (`lib/seed.ts`) | simulated `FRYS-####` |
| Admin token only | built-in frozen list (real variant IDs) | **creates a real draft order** |
| Admin token + collection | **live from that Shopify collection** | **creates a real draft order** |

So you can demo it immediately, then make it live by adding one token, then make
it pull your full live range by pointing it at a collection.

---

## 1. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it runs in demo mode (built-in frozen list).

## 2. Make orders real (add your Admin token)

1. Copy the env file: `cp .env.example .env.local`
2. In Shopify admin → **Settings → Apps and sales channels → Develop apps →
   Create an app**.
3. Under **Configuration → Admin API integration**, add scopes:
   `read_products`, `write_draft_orders`.
4. **Install app**, then reveal the **Admin API access token** (`shpat_…`).
5. Put it in `.env.local`:
   ```
   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxx
   ```
6. Restart `npm run dev`. Now **Send bestilling** creates a real draft order with
   the built-in frozen items (their real variant IDs are baked in).

   Find them in admin under **Orders → Drafts**, filtered by the `kiosk` tag.

## 3. Pull your full live frozen range (optional)

The store has no single "Frysevarer" collection today (your categories are vendor
collections + catalogue logic). To drive the kiosk from live data, make one
collection that holds exactly what should appear in the freezer kiosk, then:

```
KIOSK_COLLECTION_ID=gid://shopify/Collection/123456789
```

The kiosk then lists every product in that collection (image, vendor, price, SKU,
NYHET for items added in the last 45 days) and auto-buckets them into
Iskrem / Pelmeni / Fisk & Kjøtt by keyword. Adjust the buckets in
`categorize()` inside `lib/shopify.ts`.

---

## 4. Deploy to Vercel

```bash
vercel
```

Add the same env vars in **Vercel → Project → Settings → Environment Variables**.
Redeploy. You get a URL like `nordic-engros-kiosk.vercel.app`.

## 5. Lock the tablet to it (kiosk mode)

On the 32" Android tablet:

1. Install **Fully Kiosk Browser** from the Play Store.
2. Set **Start URL** to your Vercel URL.
3. Enable: fullscreen, hide nav/status bar, disable the back/home buttons,
   keep screen on, auto-reload on idle.
4. (Optional) set a screensaver / motion to draw people in.

That's a real self-order kiosk — McDonald's-style, your brand, your stock.

---

## Decisions still open

- **Unit vs case.** Right now the price shown and ordered is the **case price**
  (the real Shopify variant price), with the per-unit price in small text under it.
  This keeps what the customer sees = what gets ordered = what's invoiced. If you'd
  rather order/charge per single unit, that's a small change in `lib/seed.ts`
  (use `perUnit`) and the order line quantity logic.
- **B2B pricing.** The kiosk shows list prices. If kiosk users are account
  customers with their own pricing, add a "kundenr" step that loads their prices —
  a phase-2 addition; the draft-order flow already carries the reference into the note.

## Files

```
app/page.tsx            the kiosk UI (client)
app/globals.css         Nordic Engros brand styling
app/api/products/route  GET frozen products
app/api/order/route     POST -> Shopify draft order
lib/shopify.ts          Admin API: fetch products + draftOrderCreate
lib/seed.ts             built-in frozen list (real products + variant IDs)
.env.example            config template
```
