import Kiosk from "./Kiosk";
import { visibleCategories } from "@/lib/categories";
import { hasShopifyCreds } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Kiosk categories={visibleCategories()} demo={!hasShopifyCreds()} />;
}
