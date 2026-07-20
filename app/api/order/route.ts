import { NextResponse } from "next/server";
import { createDraftOrder, OrderLine } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      lines?: OrderLine[];
      reference?: string;
      customerId?: string;
    };
    const lines = (body.lines || []).filter((l) => l.variantId && l.quantity > 0);
    if (!lines.length) {
      return NextResponse.json({ ok: false, error: "Tom bestilling" }, { status: 400 });
    }
    const result = await createDraftOrder(
      lines,
      body.reference?.trim() || "",
      body.customerId?.trim() || undefined
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ukjent feil" },
      { status: 500 }
    );
  }
}
