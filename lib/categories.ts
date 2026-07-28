// lib/categories.ts
//
// Kiosk category tree, seeded from the live Shopify "nettbutikk" navigation menu.
// ORDER IS MEANINGFUL — it mirrors the webshop rail. Do not sort.
//
// This static tree is the fallback the rail renders instantly; /api/menu upgrades
// it to the live menu once the token has read_online_store_navigation.
//
// "Varmedrikker" was dropped: it pointed at the same collection as "Te & Kaffe"
// (293789827264) and would render duplicate products. Its child "Te"
// (296123957440) is hoisted to top level instead.

export type Category = {
  /** Display title, as shown in the webshop menu */
  title: string;
  /** Numeric Shopify collection ID (no gid:// prefix) */
  collectionId: number;
  /** Nested sub-categories, in menu order */
  children?: Category[];
};

export const CATEGORIES: Category[] = [
  { title: "Nyheter", collectionId: 279263576256 },
  { title: "Tilbud", collectionId: 301537820864 },
  { title: "Brød & Kaker", collectionId: 296124547264 },
  { title: "Bakevarer", collectionId: 319569199296 },
  { title: "Barnegodteri", collectionId: 298059399360 },
  { title: "Chips", collectionId: 295971389632 },
  { title: "Dadler", collectionId: 298287366336 },
  { title: "Frukt & Grønnsaker", collectionId: 327923073216 },
  { title: "Frokostblandinger", collectionId: 287009374400 },
  { title: "Fiskeprodukter", collectionId: 296124317888 },
  { title: "Frysevarer", collectionId: 334622458048 },
  { title: "Grønnsaker i lake", collectionId: 288541769920 },
  { title: "Hermetikk", collectionId: 293869715648 },
  { title: "Honning", collectionId: 314140229824 },
  {
    title: "Juice & Drikkevarer",
    collectionId: 279263543488,
    children: [
      { title: "Brus", collectionId: 296124252352 },
      { title: "Energidrikker", collectionId: 287284265152 },
      { title: "Syrup / Saft", collectionId: 287009276096 },
      { title: "Iste", collectionId: 296124285120 },
      { title: "Iskaffe", collectionId: 296124022976 },
      { title: "Alkoholfri Øl", collectionId: 288712622272 },
      { title: "Juice", collectionId: 296125432000 },
    ],
  },
  { title: "Kjeks & Småkaker", collectionId: 294046204096 },
  { title: "Kornprodukter & Ris", collectionId: 293702467776 },
  { title: "Kjølevarer", collectionId: 296124416192 },
  { title: "Kakaopulver", collectionId: 296124186816 },
  { title: "Krydder, Krydder Saus & Buljonger", collectionId: 296123859136 },
  { title: "Majones & Sennep", collectionId: 296123826368 },
  { title: "Nudler", collectionId: 298049077440 },
  { title: "Nøtter & Frø", collectionId: 298059333824 },
  { title: "Non food", collectionId: 298135224512 },
  { title: "Oljer & Eddik", collectionId: 299667980480 },
  { title: "Oliven", collectionId: 300199215296 },
  { title: "Pasta & Spaghetti", collectionId: 287009308864 },
  { title: "Pålegg", collectionId: 296193622208 },
  { title: "Sjokolader & Snacks", collectionId: 279362601152 },
  { title: "Sauser", collectionId: 287009341632 },
  { title: "Supper", collectionId: 288544063680 },
  { title: "Snacks", collectionId: 296124612800 },
  { title: "Te & Kaffe", collectionId: 293789827264 },
  { title: "Te", collectionId: 296123957440 },
  { title: "Tomatpure & Passata", collectionId: 296124219584 },
  { title: "Tørkede Frukt/Sopp/Frø", collectionId: 296124055744 },
  { title: "Tørrmelk & Kondensert melk", collectionId: 298678616256 },
  { title: "Vaffelkjeks", collectionId: 296124514496 },
  { title: "Vaskemidler", collectionId: 298678649024 },
  { title: "Drikkevarer (AR)", collectionId: 299018322112 },
  { title: "Krydder (AR)", collectionId: 299018256576 },
  { title: "Søtsaker (AR)", collectionId: 300018041024 },
  { title: "Tahina & Halawa (AR)", collectionId: 300455788736 },
];

/** Flatten the tree (parents + children) in menu order. */
export function flattenCategories(list: Category[] = CATEGORIES): Category[] {
  const out: Category[] = [];
  for (const c of list) {
    out.push(c);
    if (c.children?.length) out.push(...flattenCategories(c.children));
  }
  return out;
}

/** Find a node anywhere in the tree by its numeric collection ID. */
export function findByCollectionId(
  id: number,
  list: Category[] = CATEGORIES
): Category | undefined {
  return flattenCategories(list).find((c) => c.collectionId === id);
}

export default CATEGORIES;
