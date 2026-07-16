import { NextResponse } from "next/server";
import { getCollectionProducts, searchProducts, hasShopifyCreds } from "@/lib/shopify";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("cat");
  const q = searchParams.get("q");
  const cursor = searchParams.get("cursor") || undefined;

  if (!hasShopifyCreds()) {
    return NextResponse.json(
      { products: [], cursor: null, hasNext: false, demo: true },
      { status: 200 }
    );
  }

  try {
    if (q && q.trim()) {
      const page = await searchProducts(q, cursor);
      return NextResponse.json(page);
    }
    const cat = CATEGORIES.find((c) => c.handle === handle) || CATEGORIES[0];
    const page = await getCollectionProducts(cat.id, cursor);
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json(
      {
        products: [],
        cursor: null,
        hasNext: false,
        error: err instanceof Error ? err.message : "Ukjent feil",
      },
      { status: 500 }
    );
  }
}
