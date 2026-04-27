#!/usr/bin/env node
/**
 * Harborwatch Ship Image Enricher
 *
 * Fetches ship images from Wikipedia's REST API and stores them in ship_metadata.
 * Images come from Wikimedia Commons — freely licensed (CC), confirmed match
 * because they're the lead image of the ship's own Wikipedia article.
 *
 * Usage:
 *   node enrich-images.mjs
 *   node enrich-images.mjs --api https://harborwatch-api.onrender.com --key YOUR_KEY
 *   node enrich-images.mjs --dry-run   (preview without writing to DB)
 */

// ── Wikipedia article name map ────────────────────────────────────────────────
// Key:   ship name as stored in DB (uppercase)
// Value: exact Wikipedia article title
//
// Rules used:
//  - Holland America ships use "MS " prefix
//  - Norwegian, Royal Caribbean, Celebrity ships use no prefix
//  - Princess ships use no prefix (they dropped the "MS" branding)
//  - Some ships have no Wikipedia article → null (will be skipped)

const WIKI_ARTICLES = {
  // Holland America Line
  "EURODAM":              "MS Eurodam",
  "NIEUW AMSTERDAM":      "MS Nieuw Amsterdam (2010)",
  "NIEUW STATENDAM":      "MS Nieuw Statendam",
  "NOORDAM":              "MS Noordam",
  "OOSTERDAM":            "MS Oosterdam",
  "WESTERDAM":            "MS Westerdam",
  "ZAANDAM":              "MS Zaandam",

  // Princess Cruises
  "CORAL PRINCESS":       "Coral Princess",
  "DISCOVERY PRINCESS":   "Discovery Princess",
  "EMERALD PRINCESS":     "Emerald Princess",
  "GRAND PRINCESS":       "Grand Princess",
  "ISLAND PRINCESS":      "MS Island Princess (2002)",
  "RUBY PRINCESS":        "Ruby Princess (ship)",
  "STAR PRINCESS":        "Star Princess (ship)",

  // Norwegian Cruise Line
  "NORWEGIAN BLISS":      "Norwegian Bliss",
  "NORWEGIAN ENCORE":     "Norwegian Encore",
  "NORWEGIAN JOY":        "Norwegian Joy",

  // Royal Caribbean
  "OVATION OF THE SEAS":  "Ovation of the Seas",
  "RADIANCE OF THE SEAS": "Radiance of the Seas",
  "SERENADE OF THE SEAS": "Serenade of the Seas",

  // Carnival Cruise Line
  "CARNIVAL LUMINOSA":    "Carnival Luminosa",
  "CARNIVAL MIRACLE":     "Carnival Miracle",
  "CARNIVAL SPIRIT":      "Carnival Spirit",

  // Celebrity Cruises
  "CELEBRITY EDGE":       "Celebrity Edge",
  "CELEBRITY SOLSTICE":   "Celebrity Solstice",

  // Expedition / small ship
  "NATIONAL GEOGRAPHIC QUEST":    "National Geographic Quest",
  "NATIONAL GEOGRAPHIC VENTURE":  null,  // No Wikipedia article — handled via DIRECT_IMAGES below
  "NG SEA BIRD":                  null,  // No Wikipedia article — handled via DIRECT_IMAGES below
  "NG SEA LION":                  null,  // No Wikipedia article — handled via DIRECT_IMAGES below
  "ROALD AMUNDSEN":               "MS Roald Amundsen",
  "SEVEN SEAS EXPLORER":          "Seven Seas Explorer",
};

// Larger image size — request 800px wide thumbnail
const IMG_WIDTH = 800;

// ── Direct Wikimedia Commons image URLs ───────────────────────────────────────
// For ships with no Wikipedia article, use a verified Wikimedia Commons image.
// All images CC-licensed. Sourced from commons.wikimedia.org.
const DIRECT_IMAGES = {
  "NATIONAL GEOGRAPHIC VENTURE": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/National_Geographic_Venture_in_Sitka%2C_Alaska_%2842831774292%29.jpg/800px-National_Geographic_Venture_in_Sitka%2C_Alaska_%2842831774292%29.jpg",
    caption: "National Geographic Venture in Sitka, Alaska — Wikimedia Commons (CC BY 2.0)",
  },
  "NG SEA BIRD": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/National_Geographic_Sea_Bird_%2841424013854%29.jpg/800px-National_Geographic_Sea_Bird_%2841424013854%29.jpg",
    caption: "National Geographic Sea Bird — Wikimedia Commons (CC BY 2.0)",
  },
  "NG SEA LION": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/National_Geographic_Sea_Lion_at_Friday_Harbor_2018.jpg/800px-National_Geographic_Sea_Lion_at_Friday_Harbor_2018.jpg",
    caption: "National Geographic Sea Lion at Friday Harbor — Wikimedia Commons (CC BY-SA 4.0)",
  },
};



async function fetchWikiImage(articleTitle) {
  const encoded = encodeURIComponent(articleTitle);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Harborwatch/1.0 (https://github.com/bloqhead/harborwatch; cruise ship schedule app)",
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    if (resp.status === 404) return { found: false, reason: "article not found" };
    return { found: false, reason: `HTTP ${resp.status}` };
  }

  const data = await resp.json();

  if (data.type === "disambiguation") {
    return { found: false, reason: "disambiguation page" };
  }

  if (!data.thumbnail?.source) {
    return { found: false, reason: "article exists but no image" };
  }

  // Upgrade thumbnail to larger size
  const imageUrl = data.thumbnail.source.replace(/\/\d+px-/, `/${IMG_WIDTH}px-`);
  const caption = `${data.title} — via Wikipedia (${data.content_urls?.desktop?.page ?? url})`;

  return {
    found: true,
    imageUrl,
    caption,
    articleTitle: data.title,
    description: data.description,
  };
}

async function downloadAndStoreImage(apiBase, apiKey, shipName, imageUrl, caption, dryRun) {
  if (dryRun) return true;

  // Fetch the image from Wikimedia
  let imageResp;
  try {
    imageResp = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Harborwatch/1.0 (https://github.com/bloqhead/harborwatch)",
        "Referer": "https://en.wikipedia.org/",
      },
    });
    if (!imageResp.ok) throw new Error(`HTTP ${imageResp.status}`);
  } catch (e) {
    console.log(`\n    ⚠️  Image fetch failed: ${e.message}`);
    return false;
  }

  const mimeType = imageResp.headers.get("content-type") ?? "image/jpeg";
  const arrayBuf = await imageResp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  // Encode as base64
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const imageData = btoa(binary);

  // POST to API
  const resp = await fetch(`${apiBase}/api/ship-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({ name: shipName, imageData, mimeType, caption }),
  });

  if (resp.status === 401) {
    console.error("\n❌ 401 Unauthorized — check your --key");
    process.exit(1);
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    console.log(`\n    ⚠️  API error: ${err.error ?? resp.status}`);
    return false;
  }

  const result = await resp.json();
  return result.success ?? false;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let apiBase = "http://localhost:8000", apiKey, dryRun = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--api")     apiBase = args[++i];
  if (args[i] === "--key")     apiKey  = args[++i];
  if (args[i] === "--dry-run") dryRun  = true;
}
apiKey = apiKey ?? process.env.HARBORWATCH_API_KEY;

console.log(`⚓ Harborwatch Ship Image Enricher`);
console.log(`   API:     ${apiBase}`);
console.log(`   Auth:    ${apiKey ? "✅ key set" : "none (local dev)"}`);
console.log(`   Mode:    ${dryRun ? "DRY RUN (no writes)" : "live"}\n`);

let found = 0, missing = 0, skipped = 0, errors = 0;

for (const [shipName, articleTitle] of Object.entries(WIKI_ARTICLES)) {
  process.stdout.write(`  ${shipName.padEnd(30)}`);

  if (!articleTitle) {
    // Check for a direct Wikimedia Commons image
    const direct = DIRECT_IMAGES[shipName];
    if (direct) {
      process.stdout.write("downloading... ");
      const ok = await downloadAndStoreImage(apiBase, apiKey, shipName, direct.url, direct.caption, dryRun);
      console.log(ok ? `✅ stored locally` : `❌ failed`);
      ok ? found++ : errors++;
    } else {
      console.log("⏭  no Wikipedia article");
      skipped++;
    }
    continue;
  }

  try {
    const result = await fetchWikiImage(articleTitle);

    if (!result.found) {
      console.log(`❌ ${result.reason}`);
      missing++;
      continue;
    }

    process.stdout.write("downloading... ");
    const ok = await downloadAndStoreImage(apiBase, apiKey, shipName, result.imageUrl, result.caption, dryRun);

    if (ok) {
      console.log(`✅ ${result.articleTitle}`);
      if (dryRun) console.log(`      → ${result.imageUrl}`);
      found++;
    } else {
      console.log(`❌ failed`);
      errors++;
    }

    // Be polite to Wikipedia — 100ms between requests
    await new Promise(r => setTimeout(r, 100));

  } catch (e) {
    console.log(`💥 ${e.message}`);
    errors++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   ✅ Found & stored: ${found}`);
console.log(`   ❌ No image:       ${missing}`);
console.log(`   ⏭  Skipped:        ${skipped}`);
console.log(`   💥 Errors:         ${errors}`);

if (missing > 0 || skipped > 0) {
  console.log(`\n💡 For ships without images, add image_url manually via:`);
  console.log(`   node enrich-ships.mjs --api ${apiBase}${apiKey ? " --key YOUR_KEY" : ""}`);
  console.log(`   (add image_url and image_caption fields to the SHIPS array)`);
}
