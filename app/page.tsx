import Kiosk from "./Kiosk";
import { CATEGORIES } from "@/lib/categories";
import { hasShopifyCreds } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default function Page() {
  // Render instantly with the static tree; Kiosk upgrades to the live Shopify
  // menu via /api/menu on mount.
  return <Kiosk categories={CATEGORIES} demo={!hasShopifyCreds()} />;
}
