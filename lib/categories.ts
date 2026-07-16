// Category list mirrored from the webshop nav (nordicengros.com/collections/hovedside).
// IDs and counts verified live against Shopify.
// This is the single place to change what the kiosk shows — reorder, remove, or
// add entries here and the rail follows.

export interface KioskCategory {
  id: string;          // Shopify collection GID
  handle: string;
  name: string;        // label shown in the rail (Norwegian, as on the webshop)
  icon: string;
  count: number;       // product count at time of writing — display hint only
  group?: string;      // optional parent, for sub-categories
  hidden?: boolean;    // keep in the file but off the kiosk
}

const C = (id: string) => `gid://shopify/Collection/${id}`;

export const CATEGORIES: KioskCategory[] = [
  // --- highlights ---
  { id: C("279263576256"), handle: "siste-ankomst", name: "Nyheter", icon: "✨", count: 3316 },
  { id: C("301537820864"), handle: "tilbud", name: "Tilbud", icon: "🏷️", count: 17 },

  // --- main range ---
  { id: C("334622458048"), handle: "frysevarer", name: "Frysevarer", icon: "🧊", count: 286 },
  { id: C("296124416192"), handle: "kjolevarer", name: "Kjølevarer", icon: "🧀", count: 493 },
  { id: C("279362601152"), handle: "sjokolader-snacks", name: "Sjokolader & Snacks", icon: "🍫", count: 788 },
  { id: C("279263543488"), handle: "juice-drikkevarer", name: "Juice & Drikkevarer", icon: "🧃", count: 610 },
  { id: C("295971389632"), handle: "chips", name: "Chips", icon: "🥔", count: 179 },
  { id: C("298135224512"), handle: "non-food", name: "Non food", icon: "🧴", count: 342 },
  { id: C("300018041024"), handle: "sotsaker-ar", name: "Søtsaker (AR)", icon: "🍬", count: 195 },
  { id: C("293702467776"), handle: "mel-sukker", name: "Kornprodukter & Ris", icon: "🌾", count: 164 },
  { id: C("299018256576"), handle: "krydder-ar", name: "Krydder (AR)", icon: "🌶️", count: 162 },
  { id: C("294046204096"), handle: "kjeks", name: "Kjeks & Småkaker", icon: "🍪", count: 145 },
  { id: C("288541769920"), handle: "syltet-gronnsaker", name: "Grønnsaker i lake", icon: "🥒", count: 141 },
  { id: C("293789827264"), handle: "te", name: "Te & Kaffe", icon: "☕", count: 136 },
  { id: C("296123859136"), handle: "krydder-saus-buljonger", name: "Krydder, Saus & Buljong", icon: "🧂", count: 122 },
  { id: C("298678517952"), handle: "te-kaffe", name: "Kaffe & Te (AR)", icon: "☕", count: 94 },
  { id: C("296124612800"), handle: "snacks", name: "Snacks", icon: "🥨", count: 93 },
  { id: C("287009341632"), handle: "pasta-sauser", name: "Sauser", icon: "🥫", count: 90 },
  { id: C("298049077440"), handle: "nudler-1", name: "Nudler", icon: "🍜", count: 89 },
  { id: C("299667980480"), handle: "oljer-eddikk", name: "Oljer & Eddik", icon: "🫒", count: 85 },
  { id: C("299018322112"), handle: "drikkevarer-ar", name: "Drikkevarer (AR)", icon: "🥤", count: 80 },
  { id: C("298059333824"), handle: "notter-fro", name: "Nøtter & Frø", icon: "🥜", count: 73 },
  { id: C("293869715648"), handle: "ferdigretter", name: "Hermetikk", icon: "🥫", count: 67 },
  { id: C("296123826368"), handle: "majones-sennep", name: "Majones & Sennep", icon: "🥚", count: 60 },
  { id: C("300199215296"), handle: "oliven", name: "Oliven", icon: "🫒", count: 59 },
  { id: C("287009308864"), handle: "pasta-spaghetti-1", name: "Pasta & Spaghetti", icon: "🍝", count: 58 },
  { id: C("296124547264"), handle: "kake", name: "Brød & Kaker", icon: "🍰", count: 56 },
  { id: C("296124514496"), handle: "vaffelkjeks", name: "Vaffelkjeks", icon: "🧇", count: 53 },
  { id: C("319569199296"), handle: "bakevarer", name: "Bakevarer", icon: "🥐", count: 51 },
  { id: C("288544063680"), handle: "supper", name: "Supper", icon: "🍲", count: 47 },
  { id: C("298059399360"), handle: "barnegodteri", name: "Barnegodteri", icon: "🧸", count: 38 },
  { id: C("300455788736"), handle: "tahin-halawa", name: "Tahina & Halawa (AR)", icon: "🍯", count: 38 },
  { id: C("298287366336"), handle: "dadler", name: "Dadler", icon: "🌴", count: 40 },
  { id: C("296124055744"), handle: "torkede-frukt-sopp-fro", name: "Tørket Frukt/Sopp/Frø", icon: "🍇", count: 40 },
  { id: C("298678616256"), handle: "melkepulver", name: "Tørrmelk & Kondensert", icon: "🥛", count: 37 },
  { id: C("296124219584"), handle: "tomatpure-passata", name: "Tomatpuré & Passata", icon: "🍅", count: 35 },
  { id: C("296193622208"), handle: "postei", name: "Pålegg", icon: "🥪", count: 22 },
  { id: C("298678649024"), handle: "vaskemidler-1", name: "Vaskemidler", icon: "🧼", count: 63 },
  { id: C("296124317888"), handle: "fiskeprodukter", name: "Fiskeprodukter", icon: "🐟", count: 27 },
  { id: C("314140229824"), handle: "honning", name: "Honning", icon: "🍯", count: 27 },
  { id: C("287009374400"), handle: "frokostblanding", name: "Frokostblandinger", icon: "🥣", count: 24 },
  { id: C("327923073216"), handle: "frukt-og-gronnsaker", name: "Frukt & Grønnsaker", icon: "🥦", count: 17 },
  { id: C("296124186816"), handle: "kakaopulver", name: "Kakaopulver", icon: "🍫", count: 2 },

  // --- sub-categories of Juice & Drikkevarer (on the webshop they nest;
  //     the kiosk rail is flat, so they're marked and hidden by default) ---
  { id: C("296125432000"), handle: "juice", name: "Juice", icon: "🧃", count: 116, group: "juice-drikkevarer", hidden: true },
  { id: C("287284265152"), handle: "energidrikker", name: "Energidrikker", icon: "⚡", count: 85, group: "juice-drikkevarer", hidden: true },
  { id: C("296124252352"), handle: "brus", name: "Brus", icon: "🥤", count: 74, group: "juice-drikkevarer", hidden: true },
  { id: C("287009276096"), handle: "syrup-saft", name: "Syrup / Saft", icon: "🍹", count: 41, group: "juice-drikkevarer", hidden: true },
  { id: C("288712622272"), handle: "alkoholfri-ol", name: "Alkoholfri Øl", icon: "🍺", count: 24, group: "juice-drikkevarer", hidden: true },
  { id: C("296124022976"), handle: "iskaffe", name: "Iskaffe", icon: "🧋", count: 9, group: "juice-drikkevarer", hidden: true },
  { id: C("296124285120"), handle: "iste", name: "Iste", icon: "🧊", count: 8, group: "juice-drikkevarer", hidden: true },

  // --- sub-categories of Varmedrikker ---
  { id: C("296123957440"), handle: "te-1", name: "Te", icon: "🍵", count: 82, group: "te", hidden: true },
  { id: C("296123990208"), handle: "kaffe", name: "Kaffe & Cappucino", icon: "☕", count: 81, group: "te", hidden: true },
];

/** What the kiosk rail actually shows. */
export const visibleCategories = () => CATEGORIES.filter((c) => !c.hidden);

export const byHandle = (h: string) => CATEGORIES.find((c) => c.handle === h);
