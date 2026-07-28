// app/api/menu/route.ts
//
// Returns the kiosk category tree. Source of truth is the live Shopify
// "nettbutikk" navigation menu, so the kiosk follows whatever you set in Shopify
// admin. If that call fails — most likely the token lacking
// `read_online_store_navigation` — it falls back to the static tree in
// lib/categories.ts. The rail must never render empty on an unattended panel.

import { NextResponse } from "next/server";
import { CATEGORIES, type Category } from "@/lib/categories";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
// `menus` needs Admin API 2024-07+. Repo default is 2025-01.
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-01";

const CACHE_MS = 15 * 60 * 1000;
let cache: { at: number; data: Category[] } | null = null;

// menu(handle:) does NOT exist in the Admin API — only menu(id:) and menus().
const QUERY = `
  query KioskMenu {
    menus(first: 20) {
      nodes {
        handle
        items {
          title
          type
          resourceId
          items {
            title
            type
            resourceId
          }
        }
      }
    }
  }
`;

type RawItem = {
  title: string;
  type: string;
  resourceId: string | null;
  items?: RawItem[];
};

/** "gid://shopify/Collection/123" -> 123 */
function toCollectionId(gid: string | null): number | null {
  if (!gid) return null;
  const tail = gid.split("/").pop();
  const n = Number(tail);
  return Number.isFinite(n) ? n : null;
}

// Keep only COLLECTION links, preserve menu order, drop duplicate collections
// (a repeat would render the same products under two headings). Children of a
// dropped duplicate are hoisted to its level so we never lose them.
function normalise(items: RawItem[], seen: Set<number>): Category[] {
  const out: Category[] = [];
  for (const item of items) {
    if (item.type !== "COLLECTION") continue;
    const collectionId = toCollectionId(item.resourceId);
    if (collectionId === null) continue;

    const children = normalise(item.items ?? [], seen);
    if (seen.has(collectionId)) {
      out.push(...children);
      continue;
    }
    seen.add(collectionId);
    out.push(
      children.length > 0
        ? { title: item.title, collectionId, children }
        : { title: item.title, collectionId }
    );
  }
  return out;
}

async function fetchLiveMenu(): Promise<Category[]> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new Error("Shopify env vars missing");

  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: QUERY }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify returned ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }

  const menu = json.data?.menus?.nodes?.find(
    (n: { handle: string }) => n.handle === "nettbutikk"
  );
  if (!menu) throw new Error('No menu with handle "nettbutikk"');

  const tree = normalise(menu.items ?? [], new Set<number>());
  if (tree.length === 0) throw new Error("Menu contained no collection links");
  return tree;
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ source: "live", categories: cache.data }, { headers: NO_STORE });
  }
  try {
    const categories = await fetchLiveMenu();
    cache = { at: Date.now(), data: categories };
    return NextResponse.json({ source: "live", categories }, { headers: NO_STORE });
  } catch (err) {
    console.warn(
      "[api/menu] Live menu unavailable, serving static categories:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ source: "static", categories: CATEGORIES }, { headers: NO_STORE });
  }
}
