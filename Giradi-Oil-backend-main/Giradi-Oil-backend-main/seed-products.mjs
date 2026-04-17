#!/usr/bin/env node
/**
 * =============================================================================
 * GIRARDI OIL – Complete Product Seed/Update Script for Medusa v2
 * =============================================================================
 *
 * This script updates ALL 31 products in Medusa with complete data:
 *   - Description, subtitle, category, size, badge, details
 *   - Prices in EUR (cents)
 *   - Metadata for frontend rendering
 *
 * USAGE (run in giradi-backend codespace):
 *   1. Copy this file to your backend repo root
 *   2. Make sure MEDUSA_BACKEND_URL and MEDUSA_API_TOKEN are set (or edit below)
 *   3. Run: node seed-products.mjs
 *
 * The script will:
 *   - Fetch all existing products from Medusa Admin API
 *   - Match them by handle or title
 *   - Update matched products with full data
 *   - Create missing products
 * =============================================================================
 */

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

// You need an admin API token. Get one via:
//   curl -X POST ${BACKEND_URL}/auth/user/emailpass \
//     -H "Content-Type: application/json" \
//     -d '{"email":"admin@medusa-test.com","password":"supersecret"}'
const API_TOKEN = process.env.MEDUSA_API_TOKEN || "YOUR_TOKEN_HERE";

// ---------------------------------------------------------------------------
// Complete product catalog
// ---------------------------------------------------------------------------

const products = [
  // ─── BIO Olivenoel ───
  {
    handle: "bio-1000",
    title: "BIO-Olivenoel Extra Nativ 1L",
    description:
      "Unser Herzstueck – Das Biologische Extra Native Olivenoel, von den eigenen Baeumen der Familie Girardi! Hier bleibt von der Frucht bis zur Flasche alles in unserer Hand: Damit wir wissen, was Sie essen! Dieses Oel wird direkt nach der Pressung in die Flaschen gefuellt. Frisch gepresstes Olivenoel ist eine selten zu erhaltene Delikatesse, die ein intensives Geschmacksaroma aufweist.",
    price: 2250, // cents
    metadata: {
      category: "bio",
      categoryLabel: "BIO Olivenoel",
      subtitle: "Frisch Gepresst · 1 Liter",
      size: "1 Liter",
      badge: "Bestseller",
      details: JSON.stringify([
        "EU-BIO zertifiziert",
        "Erste Kaltpressung",
        "Frisch gepresst & abgefuellt",
        "Sortenrein Koroneiki",
        "Von eigenen Baeumen der Familie Girardi",
      ]),
    },
  },
  {
    handle: "bio-500",
    title: "BIO-Olivenoel Extra Nativ 500ml",
    description:
      "Die handliche 500-ml-Flasche unseres preisgekroenten BIO-Olivenöls – perfekt zum Kennenlernen oder als Geschenk. Direkt nach der Pressung abgefuellt fuer maximale Frische.",
    price: 1450,
    metadata: {
      category: "bio",
      categoryLabel: "BIO Olivenoel",
      subtitle: "Frisch Gepresst · 500 ml",
      size: "500 ml",
      badge: "",
      details: JSON.stringify([
        "EU-BIO zertifiziert",
        "Erste Kaltpressung",
        "Frisch gepresst & abgefuellt",
        "Sortenrein Koroneiki",
        "Von eigenen Baeumen der Familie Girardi",
      ]),
    },
  },

  // ─── Olivenoel Extra Nativ ───
  {
    handle: "en-5000",
    title: "Olivenoel Extra Nativ 5L Kanister",
    description:
      "Der grosse 5-Liter-Kanister fuer Geniesser und Familien. Hochwertiges extra natives Olivenoel der Sorte Koroneiki aus Griechenland – ideal fuer den taeglichen Gebrauch in der Kueche.",
    price: 6990,
    metadata: {
      category: "extra-nativ",
      categoryLabel: "Olivenoel Extra Nativ",
      subtitle: "Kanister · 5 Liter",
      size: "5 Liter",
      badge: "Vorteilspack",
      details: JSON.stringify([
        "Extra nativ",
        "Erste Kaltpressung",
        "Sortenrein Koroneiki",
        "Aus der Navarino-Bucht, Peloponnes",
        "2–3 Tage Lieferzeit",
      ]),
    },
  },
  {
    handle: "en-1000",
    title: "Olivenoel Extra Nativ 1L Flasche",
    description:
      "Unsere 1-Liter-Flasche mit hochwertigem extra nativen Olivenoel. Vollmundig, leicht pfeffrig im Abgang mit einer angenehmen Bitternote. Qualitaet von der Ernte bis zur Abfuellung.",
    price: 1790,
    metadata: {
      category: "extra-nativ",
      categoryLabel: "Olivenoel Extra Nativ",
      subtitle: "Flasche · 1 Liter",
      size: "1 Liter",
      badge: "",
      details: JSON.stringify([
        "Extra nativ",
        "Erste Kaltpressung",
        "Sortenrein Koroneiki",
        "Aus der Navarino-Bucht, Peloponnes",
        "2–3 Tage Lieferzeit",
      ]),
    },
  },
  {
    handle: "en-750",
    title: "Olivenoel Extra Nativ 0,75L Flasche",
    description:
      "Die elegante 0,75-Liter-Flasche – perfekt als Geschenk oder fuer den eigenen Genuss. Erstklassiges griechisches Olivenoel der Sorte Koroneiki.",
    price: 1490,
    metadata: {
      category: "extra-nativ",
      categoryLabel: "Olivenoel Extra Nativ",
      subtitle: "Flasche · 0,75 Liter",
      size: "0,75 Liter",
      badge: "",
      details: JSON.stringify([
        "Extra nativ",
        "Erste Kaltpressung",
        "Sortenrein Koroneiki",
        "Aus der Navarino-Bucht, Peloponnes",
        "2–3 Tage Lieferzeit",
      ]),
    },
  },

  // ─── Olivenoel mit Aroma ───
  {
    handle: "aroma-basilikum",
    title: "Extra Natives Olivenoel Basilikum",
    description:
      "Feines extra natives Olivenoel, verfeinert mit natuerlichem Basilikumaroma. Perfekt fuer italienische Gerichte, Caprese und frische Pasta.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-blutorange",
    title: "Extra Natives Olivenoel Blutorange",
    description:
      "Fruchtig-frisches Olivenoel mit dem suesslichen Aroma sizilianischer Blutorangen. Ideal fuer Salate, Desserts und Fischgerichte.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-chili",
    title: "Extra Natives Olivenoel Chili",
    description:
      "Fuer alle die es scharf moegen – extra natives Olivenoel mit einer angenehmen Chili-Schaerfe. Perfekt fuer Pizza, Pasta und Grillgerichte.",
    price: 870,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Feurig & Pikant",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-knoblauch",
    title: "Extra Natives Olivenoel Knoblauch",
    description:
      "Extra natives Olivenoel mit natuerlichem Knoblaucharoma. Ideal zum Braten, fuer Pasta und zum Dippen mit frischem Brot.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Wuerzig & Kraeftig",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-trueffel",
    title: "Extra Natives Olivenoel Trueffel",
    description:
      "Luxurioeses Olivenoel mit dem unverwechselbaren Aroma von Trueffeln. Ein Hauch von Eleganz fuer Risotto, Pasta und feine Vorspeisen.",
    price: 890,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Edel & Intensiv",
      size: "250 ml",
      badge: "Beliebt",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-zitrone",
    title: "Extra Natives Olivenoel Zitrone",
    description:
      "Unser extra natives Olivenoel, verfeinert mit natuerlichem Zitronenextrakt. Perfekt fuer Fisch, Salate und Meeresfruechte.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Frisch & Sommerlich",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-rosmarin",
    title: "Extra Natives Olivenoel Rosmarin",
    description:
      "Mediterrane Aromen pur – feines Olivenoel mit natuerlichem Rosmarinaroma. Perfekt fuer Focaccia, Kartoffeln und Grillgemuese.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Mediterran & Herb",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-oregano",
    title: "Extra Natives Olivenoel Oregano",
    description:
      "Der Geschmack Griechenlands in einer Flasche. Extra natives Olivenoel mit wildem Oregano – ideal fuer griechische Salate und Fleischgerichte.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Griechisch & Aromatisch",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-limette",
    title: "Extra Natives Olivenoel Limette",
    description:
      "Erfrischend und exotisch – extra natives Olivenoel mit Limettenaroma. Perfekt fuer asiatische Kueche, Ceviche und Salate.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Exotisch & Erfrischend",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-orange",
    title: "Extra Natives Olivenoel Orange",
    description:
      "Mild-fruchtiges Olivenoel mit natuerlichem Orangenaroma. Ideal fuer Desserts, Salate und zum Verfeinern von Gefluegelgerichten.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Fruchtig & Mild",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-pesto",
    title: "Extra Natives Olivenoel Pesto",
    description:
      "Olivenoel mit dem aromatischen Geschmack von Pesto. Perfekt fuer Pasta, Bruschetta und als Dip mit frischem Brot.",
    price: 870,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Italienisch & Wuerzig",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-thymian",
    title: "Extra Natives Olivenoel Thymian",
    description:
      "Herbwuerziges Olivenoel mit natuerlichem Thymianaroma. Ideal fuer Lamm, Gemuese und mediterrane Gerichte.",
    price: 850,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Herb & Mediterran",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },
  {
    handle: "aroma-kraeuter",
    title: "Extra Natives Olivenoel Kraeuter der Toskana",
    description:
      "Eine feine Komposition aus toskanischen Kraeutern und extra nativem Olivenoel. Vielseitig einsetzbar in der Kueche.",
    price: 870,
    metadata: {
      category: "aroma",
      categoryLabel: "Olivenoel mit Aroma",
      subtitle: "Aromatisiert · Italienisch & Vielseitig",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Extra nativ mit natuerlichem Aroma",
        "Kalt gepresst",
        "250 ml Glasflasche",
        "Ideal zum Verfeinern & Dippen",
      ]),
    },
  },

  // ─── Balsamessig ───
  {
    handle: "balsam-klassisch",
    title: "Balsamessig Klassisch",
    description:
      "Unser klassischer Balsamessig aus Griechenland – samtiger, vollmundiger Geschmack. Der Allrounder fuer Salate, Marinaden und als Verfeinerung von Gerichten.",
    price: 800,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Traditionell gereift · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-feige",
    title: "Balsamessig Feige",
    description:
      "Aromatischer Balsamessig mit dem suessen Geschmack reifer Feigen. Perfekt zu Kaese, Salaten und gegrilltem Gemuese.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Fruchtig & Suess · 250 ml",
      size: "250 ml",
      badge: "Beliebt",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-granatapfel",
    title: "Balsamessig Granatapfel",
    description:
      "Saeuerlich-fruchtiger Balsamessig mit dem exotischen Geschmack von Granataepfeln. Ideal fuer orientalische Salate und Marinaden.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Fruchtig & Saeuerlich · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-honig",
    title: "Balsamessig Honig",
    description:
      "Samtiger Balsamessig mit natuerlichem Honig verfeinert. Perfekt fuer Salatdressings und als Glasur fuer Gefluegel.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Suess & Mild · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-mango",
    title: "Balsamessig Mango",
    description:
      "Exotischer Balsamessig mit dem tropischen Geschmack reifer Mangos. Ideal fuer asiatisch inspirierte Gerichte und Salate.",
    price: 880,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Exotisch & Fruchtig · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-himbeere",
    title: "Balsamessig Himbeere",
    description:
      "Fruchtig-frischer Balsamessig mit dem intensiven Geschmack von Himbeeren. Perfekt fuer Desserts und frische Salate.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Beerig & Frisch · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-apfel",
    title: "Balsamessig Apfel",
    description:
      "Herb-fruchtiger Balsamessig mit dem frischen Geschmack von Aepfeln. Vielseitig einsetzbar in der Kueche.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Frisch & Herb · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-kirsche",
    title: "Balsamessig Kirsche",
    description:
      "Vollmundiger Balsamessig mit dem aromatischen Geschmack von Kirschen. Ideal zu Wild, Kaese und Desserts.",
    price: 800,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Suess & Fruchtig · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-weiss",
    title: "Balsamessig Weiss",
    description:
      "Weisser Balsamessig aus Griechenland – mild, fruchtig und vielseitig einsetzbar. Perfekt fuer helle Saucen, Fischgerichte und Salate.",
    price: 840,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Mild & Elegant · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
  {
    handle: "balsam-trueffel",
    title: "Balsamessig Trueffel",
    description:
      "Exquisiter Balsamessig verfeinert mit dem unverwechselbaren Aroma schwarzer Trueffel. Ein Hauch von Luxus fuer Risotto, Pasta und feine Vorspeisen.",
    price: 950,
    metadata: {
      category: "balsamessig",
      categoryLabel: "Balsamessig",
      subtitle: "Edel & Aromatisch · 250 ml",
      size: "250 ml",
      badge: "",
      details: JSON.stringify([
        "Traditionell gereift",
        "Aus Griechenland",
        "250 ml Glasflasche",
        "Ideal fuer Salate & Marinaden",
      ]),
    },
  },
];

// ---------------------------------------------------------------------------
// Helper: normalize title for fuzzy matching
// ---------------------------------------------------------------------------
function normalize(t) {
  return t
    .toLowerCase()
    .replace(/[äö]/g, (c) => (c === "ä" ? "ae" : "oe"))
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Admin API helpers
// ---------------------------------------------------------------------------
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

async function adminGet(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function adminPost(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Step 1: Get auth token (if not provided)
// ---------------------------------------------------------------------------
async function getAuthToken() {
  if (API_TOKEN !== "YOUR_TOKEN_HERE") return API_TOKEN;

  console.log("\n🔑 No API token set. Trying to authenticate...");
  console.log("   Set MEDUSA_API_TOKEN env var, or enter admin credentials.\n");

  const email = process.env.ADMIN_EMAIL || "admin@medusa-test.com";
  const password = process.env.ADMIN_PASSWORD || "supersecret";

  const res = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(
      `Auth failed (${res.status}). Set MEDUSA_API_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD env vars.`
    );
  }

  const data = await res.json();
  return data.token;
}

// ---------------------------------------------------------------------------
// Step 2: Fetch all existing products
// ---------------------------------------------------------------------------
async function fetchExistingProducts() {
  let all = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await adminGet(
      `/admin/products?limit=${limit}&offset=${offset}&fields=id,title,handle,variants.id,variants.prices.*`
    );
    all = all.concat(data.products || []);
    if (!data.products || data.products.length < limit) break;
    offset += limit;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Step 3: Match & update/create
// ---------------------------------------------------------------------------
async function seedProducts() {
  console.log("🫒 Girardi Oil – Product Seed Script");
  console.log("====================================\n");
  console.log(`Backend: ${BACKEND_URL}\n`);

  // Auth
  const token = await getAuthToken();
  headers.Authorization = `Bearer ${token}`;
  console.log("✅ Authenticated\n");

  // Fetch existing
  console.log("📦 Fetching existing products...");
  const existing = await fetchExistingProducts();
  console.log(`   Found ${existing.length} products in Medusa\n`);

  // We need a region + currency to set prices. Get the default region.
  const regionsData = await adminGet("/admin/regions?limit=1");
  const region = regionsData.regions?.[0];
  if (!region) {
    console.log("⚠️  No region found. Creating EUR region...");
    const newRegion = await adminPost("/admin/regions", {
      name: "Europe",
      currency_code: "eur",
      countries: ["de", "at", "gr"],
    });
    console.log("   Created region:", newRegion.region?.id);
  }
  const regionId = region?.id || (await adminGet("/admin/regions?limit=1")).regions[0].id;
  console.log(`   Using region: ${regionId}\n`);

  let updated = 0;
  let created = 0;
  let errors = 0;

  for (const product of products) {
    const normHandle = normalize(product.handle);
    const normTitle = normalize(product.title);

    // Find existing match by handle or title
    const match = existing.find((e) => {
      if (e.handle === product.handle) return true;
      const eNorm = normalize(e.title || "");
      return eNorm === normTitle || eNorm.includes(normTitle) || normTitle.includes(eNorm);
    });

    try {
      if (match) {
        // UPDATE existing product
        await adminPost(`/admin/products/${match.id}`, {
          handle: product.handle,
          title: product.title,
          description: product.description,
          metadata: product.metadata,
        });

        // Update variant price
        const variantId = match.variants?.[0]?.id;
        if (variantId) {
          await adminPost(`/admin/products/${match.id}/variants/${variantId}`, {
            prices: [{ amount: product.price, currency_code: "eur" }],
          });
        }

        console.log(`  ✏️  Updated: ${product.title} (${product.price / 100}€)`);
        updated++;
      } else {
        // CREATE new product
        const created_product = await adminPost("/admin/products", {
          title: product.title,
          handle: product.handle,
          description: product.description,
          metadata: product.metadata,
          status: "published",
          options: [{ title: "Default", values: ["Default"] }],
          variants: [
            {
              title: product.metadata.size || "Default",
              prices: [{ amount: product.price, currency_code: "eur" }],
              options: { Default: "Default" },
              manage_inventory: false,
            },
          ],
        });

        console.log(`  ✨ Created: ${product.title} (${product.price / 100}€)`);
        created++;
      }
    } catch (err) {
      console.error(`  ❌ Error for ${product.title}:`, err.message);
      errors++;
    }
  }

  console.log("\n====================================");
  console.log(`✅ Updated: ${updated}`);
  console.log(`✨ Created: ${created}`);
  if (errors) console.log(`❌ Errors:  ${errors}`);
  console.log(`📦 Total:   ${products.length} products`);
  console.log("====================================\n");
}

seedProducts().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
