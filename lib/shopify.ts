const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const VERSION = process.env.SHOPIFY_API_VERSION || "2025-01";

export const hasShopifyCreds = () => Boolean(DOMAIN && TOKEN);

export interface KioskProduct {
  id: string;          // variant GID — what a draft order line needs
  name: string;
  vendor: string;
  unit: number;        // productType = per-enhet price (what the catalogue shows)
  casePrice: number;   // variant price = what one ordered kolli costs
  sku: string;
  stock: number;
  image: string;
  ny: boolean;
}

export interface ProductPage {
  products: KioskProduct[];
  cursor: string | null;
  hasNext: boolean;
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
  return json.data as T;
}

interface Node {
  id: string;
  title: string;
  vendor: string;
  productType: string;
  totalInventory: number;
  createdAt: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: { id: string; sku: string | null; price: string } }[] };
}

const FIELDS = `
  id title vendor productType totalInventory createdAt
  featuredImage { url }
  variants(first: 1) { edges { node { id sku price } } }
`;

const NEW_DAYS = 45;

function toProduct(n: Node): KioskProduct | null {
  const v = n.variants.edges[0]?.node;
  if (!v) return null;
  const casePrice = parseFloat(v.price) || 0;
  // productType holds the per-unit price in this store. If it isn't a number,
  // fall back to the case price rather than showing a bogus 0.
  const parsedUnit = parseFloat(n.productType);
  const unit = Number.isFinite(parsedUnit) && parsedUnit > 0 ? parsedUnit : casePrice;
  return {
    id: v.id,
    name: n.title.trim(),
    vendor: n.vendor || "",
    unit,
    casePrice,
    sku: v.sku || "",
    stock: n.totalInventory ?? 0,
    image: n.featuredImage?.url || "",
    ny: Date.now() - new Date(n.createdAt).getTime() < NEW_DAYS * 864e5,
  };
}

// In-stock first. Shopify can't sort a collection by inventory, so we sort each
// loaded page — an out-of-stock item from page 1 can still sit above an in-stock
// one from page 2. Acceptable; the stock badge always tells the truth.
const inStockFirst = (a: KioskProduct, b: KioskProduct) =>
  (a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1);

const COLLECTION_QUERY = `
  query Cat($id: ID!, $cursor: String) {
    collection(id: $id) {
      products(first: 50, after: $cursor) {
        edges { node { ${FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

export async function getCollectionProducts(id: string, cursor?: string): Promise<ProductPage> {
  const data = await adminGraphql<{
    collection: {
      products: {
        edges: { node: Node }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } | null;
  }>(COLLECTION_QUERY, { id, cursor: cursor || null });

  if (!data.collection) return { products: [], cursor: null, hasNext: false };
  const products = data.collection.products.edges
    .map((e) => toProduct(e.node))
    .filter((p): p is KioskProduct => p !== null)
    .sort(inStockFirst);
  return {
    products,
    cursor: data.collection.products.pageInfo.endCursor,
    hasNext: data.collection.products.pageInfo.hasNextPage,
  };
}

const SEARCH_QUERY = `
  query Search($q: String!, $cursor: String) {
    products(first: 50, query: $q, after: $cursor, sortKey: INVENTORY_TOTAL, reverse: true) {
      edges { node { ${FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

// Search the whole catalogue, not just the open category. Sorting by
// INVENTORY_TOTAL desc puts out-of-stock last for free (this sortKey is
// supported on products, unlike on a collection).
export async function searchProducts(term: string, cursor?: string): Promise<ProductPage> {
  const t = term.trim().replace(/["\\()]/g, "");
  if (!t) return { products: [], cursor: null, hasNext: false };
  const q = `(title:*${t}* OR vendor:*${t}* OR sku:${t}*) AND status:active`;
  const data = await adminGraphql<{
    products: {
      edges: { node: Node }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(SEARCH_QUERY, { q, cursor: cursor || null });

  return {
    products: data.products.edges
      .map((e) => toProduct(e.node))
      .filter((p): p is KioskProduct => p !== null),
    cursor: data.products.pageInfo.endCursor,
    hasNext: data.products.pageInfo.hasNextPage,
  };
}

// ---------------------------------------------------------------------------

export interface OrderLine { variantId: string; quantity: number }

const DRAFT_MUTATION = `
  mutation KioskDraft($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }`;

export async function createDraftOrder(
  lines: OrderLine[],
  reference: string
): Promise<{ ok: boolean; name: string; error?: string }> {
  if (!hasShopifyCreds()) {
    // Demo mode — no token configured. Simulate so the kiosk stays testable.
    return { ok: true, name: "NE-" + Math.floor(1000 + Math.random() * 9000) };
  }
  const tag = process.env.KIOSK_ORDER_TAG || "kiosk";
  const data = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(DRAFT_MUTATION, {
    input: {
      lineItems: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      tags: [tag],
      note: reference ? `Kiosk-bestilling – ${reference}` : "Kiosk-bestilling",
    },
  });
  const r = data.draftOrderCreate;
  if (r.userErrors?.length) {
    return { ok: false, name: "", error: r.userErrors.map((e) => e.message).join(", ") };
  }
  return { ok: true, name: r.draftOrder?.name || "—" };
}
