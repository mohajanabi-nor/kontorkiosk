import { NextResponse } from "next/server";
import { searchCustomers } from "@/lib/shopify";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  try {
    const customers = await searchCustomers(q);
    return NextResponse.json({ customers }, { headers: NO_STORE });
  } catch (err) {
    // Never break the order flow over a failed typeahead — return 200 + empty.
    return NextResponse.json(
      { customers: [], error: err instanceof Error ? err.message : "Ukjent feil" },
      { status: 200, headers: NO_STORE }
    );
  }
}
