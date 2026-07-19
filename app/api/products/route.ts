import { NextResponse } from "next/server";
import { getCollectionProducts, searchProducts, hasShopifyCreds } from "@/lib/shopify";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Stock, prices and search results must always be live on the kiosk. Without an
// explicit no-store, Next serves `public, max-age=0, must-revalidate`, which a
// tablet WebView can replay stale (e.g. a pre-fix search result) on a flaky
// network. no-store forbids storing the response at all.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

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
