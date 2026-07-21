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
  status: string;
  totalInventory: number;
  createdAt: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: { id: string; sku: string | null; price: string } }[] };
}

const FIELDS = `
  id title vendor productType status totalInventory createdAt
  featuredImage { url }
  variants(first: 1) { edges { node { id sku price } } }
`;

const NEW_DAYS = 45;

function toProduct(n: Node): KioskProduct | null {
  const v = n.variants.edges[0]?.node;
  if (!v) return null;
  // Never show draft / archived products on the kiosk — only live ones.
  if (n.status !== "ACTIVE") return null;
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

const COLLECTION_PAGE = 100; // raw products pulled per Shopify call
const COLLECTION_TARGET = 48; // active products to gather before returning a page

const COLLECTION_QUERY = `
  query Cat($id: ID!, $cursor: String) {
    collection(id: $id) {
      products(first: ${COLLECTION_PAGE}, after: $cursor) {
        edges { node { ${FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

// A collection can hold long runs of draft/archived products — this store keeps
// ~44 drafts right at the front of Juice & Drikkevarer. We only ever show ACTIVE
// products, so one raw page could filter down to a handful, leaving the grid too
// short to scroll; infinite-scroll then never fires and the category looks empty.
// So keep pulling pages until we've gathered a screenful of active products (or
// run out). Curated order is preserved; the returned cursor continues paging.
export async function getCollectionProducts(id: string, cursor?: string): Promise<ProductPage> {
  const products: KioskProduct[] = [];
  let after: string | null = cursor || null;
  let hasNext = false;

  for (let page = 0; page < 8; page++) {
    const data: {
      collection: {
        products: {
          edges: { node: Node }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      } | null;
    } = await adminGraphql(COLLECTION_QUERY, { id, cursor: after });

    if (!data.collection) break;
    const conn = data.collection.products;
    for (const e of conn.edges) {
      const p = toProduct(e.node);
      if (p) products.push(p);
    }
    after = conn.pageInfo.endCursor;
    hasNext = conn.pageInfo.hasNextPage;
    if (!hasNext || products.length >= COLLECTION_TARGET) break;
  }

  return { products, cursor: after, hasNext };
}

const SEARCH_QUERY = `
  query Search($q: String!, $cursor: String) {
    products(first: 50, query: $q, after: $cursor, sortKey: RELEVANCE) {
      edges { node { ${FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

// Rank matches so the most relevant land first: a title that *starts* with the
// query beats a title that merely contains it, which beats a vendor-only match.
// Lower score = higher up.
function relevanceScore(p: KioskProduct, words: string[]): number {
  const name = p.name.toLowerCase();
  const vendor = p.vendor.toLowerCase();
  const joined = words.join(" ");
  let s = 5;
  if (name.startsWith(joined)) s = 0;
  else if (words.every((w) => name.split(/\s+/).some((tok) => tok.startsWith(w)))) s = 1;
  else if (name.includes(joined)) s = 2;
  else if (words.every((w) => name.includes(w))) s = 3;
  else if (words.every((w) => vendor.includes(w))) s = 4;
  return s;
}

// Search the whole catalogue, not just the open category.
//
// Shopify search only supports TRAILING wildcards (`milka*`) — a leading
// wildcard (`*milka*`) is invalid syntax, and Shopify's response to an invalid
// term is to ignore it and return everything, which then sorted by inventory is
// why "milka" used to surface Twix / condensed milk. So: prefix-match every word
// (AND across words), then guard the results client-side so nothing that doesn't
// actually contain the query can slip through, and rank by relevance.
export async function searchProducts(term: string, cursor?: string): Promise<ProductPage> {
  const t = term.trim().replace(/["\\()*:]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return { products: [], cursor: null, hasNext: false };

  const words = t.split(" ").filter(Boolean);
  const q =
    words.map((w) => `(title:${w}* OR vendor:${w}* OR sku:${w}*)`).join(" AND ") +
    " AND status:active";

  const data = await adminGraphql<{
    products: {
      edges: { node: Node }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(SEARCH_QUERY, { q, cursor: cursor || null });

  const lower = words.map((w) => w.toLowerCase());
  const products = data.products.edges
    .map((e) => toProduct(e.node))
    .filter((p): p is KioskProduct => p !== null)
    // Defensive guard: every query word must genuinely appear in a searchable
    // field. Belt-and-suspenders in case Shopify's matching is looser than us.
    .filter((p) => {
      const hay = `${p.name} ${p.vendor} ${p.sku}`.toLowerCase();
      return lower.every((w) => hay.includes(w));
    })
    .sort((a, b) => relevanceScore(a, lower) - relevanceScore(b, lower));

  return {
    products,
    cursor: data.products.pageInfo.endCursor,
    hasNext: data.products.pageInfo.hasNextPage,
  };
}

// ---------------------------------------------------------------------------

export interface KioskCustomer {
  id: string;        // customer GID — set as the draft order's customerId
  label: string;     // headline: company if we have one, else the person's name
  sublabel: string;  // secondary line (person/email/phone) to disambiguate
  company: string;
  name: string;
  email: string;
  phone: string;
  orders: number;    // numberOfOrders, for ranking regulars first
}

const CUSTOMER_QUERY = `
  query CustSearch($q: String!) {
    customers(first: 12, query: $q) {
      edges { node {
        id displayName email phone numberOfOrders
        defaultAddress { company address1 city }
      } }
    }
  }`;

// Typeahead for the order sheet. Same trailing-wildcard rule as product search
// (Shopify rejects leading wildcards): prefix-match every word across
// first_name/last_name/email/phone, AND-ed together. Returns [] in demo mode or
// for <2 chars so we never fire a pointless query.
export async function searchCustomers(term: string): Promise<KioskCustomer[]> {
  if (!hasShopifyCreds()) return [];
  const t = term.trim().replace(/["\\()*:]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 2) return [];

  const words = t.split(" ").filter(Boolean);
  const q = words
    .map(
      (w) =>
        `(first_name:${w}* OR last_name:${w}* OR email:${w}* OR phone:${w}* OR company:${w}*)`
    )
    .join(" AND ");

  const data = await adminGraphql<{
    customers: {
      edges: {
        node: {
          id: string;
          displayName: string | null;
          email: string | null;
          phone: string | null;
          numberOfOrders: string | null;
          defaultAddress: {
            company: string | null;
            address1: string | null;
            city: string | null;
          } | null;
        };
      }[];
    };
  }>(CUSTOMER_QUERY, { q });

  return data.customers.edges
    .map((e) => {
      const n = e.node;
      const company = n.defaultAddress?.company?.trim() || "";
      const name = (n.displayName || "").trim();
      const email = n.email || "";
      const phone = n.phone || "";
      const orders = parseInt(n.numberOfOrders || "0", 10) || 0;
      // Prefer the address for the secondary line — it disambiguates two stores
      // with similar names better than an email/phone does.
      const addr = [n.defaultAddress?.address1, n.defaultAddress?.city]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(", ");
      return {
        id: n.id,
        label: company || name || email || "Kunde",
        sublabel: addr || (company ? name : "") || email || phone,
        company,
        name,
        email,
        phone,
        orders,
      };
    })
    // B2B customers (those with a company) first, then the most frequent buyers.
    .sort((a, b) => (b.company ? 1 : 0) - (a.company ? 1 : 0) || b.orders - a.orders);
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

// Turn the draft into a real order. paymentPending:true creates an OPEN, unpaid
// order (financial status "pending") — it shows under Orders, not Drafts, and
// staff settle payment at the counter. No inventory is charged twice.
const DRAFT_COMPLETE = `
  mutation KioskComplete($id: ID!) {
    draftOrderComplete(id: $id, paymentPending: true) {
      draftOrder { id order { id name } }
      userErrors { field message }
    }
  }`;

// Create the order the kiosk sends. We build a draft first (the only input that
// cleanly carries customer + tags + note in one call), then immediately COMPLETE
// it into a real, unpaid order so it lands under Orders instead of staying a draft.
export async function createOrder(
  lines: OrderLine[],
  reference: string,
  customerId?: string
): Promise<{ ok: boolean; name: string; error?: string }> {
  if (!hasShopifyCreds()) {
    // Demo mode — no token configured. Simulate so the kiosk stays testable.
    return { ok: true, name: "NE-" + Math.floor(1000 + Math.random() * 9000) };
  }
  const tag = process.env.KIOSK_ORDER_TAG || "kiosk";

  // 1) Create the draft.
  const created = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(DRAFT_MUTATION, {
    input: {
      lineItems: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      tags: [tag],
      note: reference ? `Kiosk-bestilling – ${reference}` : "Kiosk-bestilling",
      ...(customerId ? { customerId } : {}),
    },
  });
  const c = created.draftOrderCreate;
  if (c.userErrors?.length) {
    return { ok: false, name: "", error: c.userErrors.map((e) => e.message).join(", ") };
  }
  const draftId = c.draftOrder?.id;
  if (!draftId) return { ok: false, name: "", error: "Kunne ikke opprette ordre" };

  // 2) Complete it into a real (unpaid) order.
  const done = await adminGraphql<{
    draftOrderComplete: {
      draftOrder: { id: string; order: { id: string; name: string } | null } | null;
      userErrors: { field: string[]; message: string }[];
    };
  }>(DRAFT_COMPLETE, { id: draftId });
  const d = done.draftOrderComplete;
  if (d.userErrors?.length) {
    return { ok: false, name: "", error: d.userErrors.map((e) => e.message).join(", ") };
  }
  // Prefer the completed order's number (#1001); fall back to the draft name.
  return { ok: true, name: d.draftOrder?.order?.name || c.draftOrder?.name || "—" };
}
