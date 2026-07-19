import { NextResponse } from "next/server";
import { getCollectionProducts, searchProducts, hasShopifyCreds } from "@/lib/shopify";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Stock, prices and search results must always be live on the kiosk. Without an
// explicit no-store, Next serves `public, max-age=0, must-revalidate`, which a
// tablet WebView can replay stale (e.g. a pre-fix search result) on a flaky
// network. no-store forbids storing the response at all.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// Fold Norwegian letters + accents so a customer typing "kjol" or "sotsaker"
// still matches "Kjølevarer" / "Søtsaker".
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .trim();

// If the search term names a category, we show that whole collection instead of
// a product-name search — "sjokolade" should surface all of Sjokolader & Snacks,
// not just products with that literal word in the title. Prefer the most exact
// match; require ≥3 chars so short brand fragments don't accidentally hijack.
function matchCategory(q: string) {
  const s = norm(q);
  if (s.length < 3) return null;
  const cats = CATEGORIES;
  return (
    cats.find((c) => norm(c.name) === s) ||
    cats.find((c) => norm(c.name).startsWith(s)) ||
    cats.find((c) => norm(c.name).split(/[^a-z0-9]+/).some((w) => w && w.startsWith(s))) ||
    null
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("cat");
  const q = searchParams.get("q");
  const cursor = searchParams.get("cursor") || undefined;

  if (!hasShopifyCreds()) {
    return NextResponse.json(
      { products: [], cursor: null, hasNext: false, demo: true },
      { status: 200, headers: NO_STORE }
    );
  }

  try {
    if (q && q.trim()) {
      const catMatch = matchCategory(q);
      if (catMatch) {
        const page = await getCollectionProducts(catMatch.id, cursor);
        return NextResponse.json(
          { ...page, matchedCategory: catMatch.name },
          { headers: NO_STORE }
        );
      }
      const page = await searchProducts(q, cursor);
      return NextResponse.json(page, { headers: NO_STORE });
    }
    const cat = CATEGORIES.find((c) => c.handle === handle) || CATEGORIES[0];
    const page = await getCollectionProducts(cat.id, cursor);
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      {
        products: [],
        cursor: null,
        hasNext: false,
        error: err instanceof Error ? err.message : "Ukjent feil",
      },
      { status: 500, headers: NO_STORE }
    );
  }
}
