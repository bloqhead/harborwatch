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
  "EMERALD PRINCESS":     "Emerald Princess (ship)",
  "GRAND PRINCESS":       "Grand Princess",
  "ISLAND PRINCESS":      "Island Princess (ship)",
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
  "NATIONAL GEOGRAPHIC QUEST":   "National Geographic Quest",
  "NATIONAL GEOGRAPHIC VENTURE":  null,  // no Wikipedia article
  "NG SEA BIRD":          null,  // no Wikipedia article
  "NG SEA LION":          null,  // no Wikipedia article
  "ROALD AMUNDSEN":       "MS Roald Amundsen",
  "SEVEN SEAS EXPLORER":  "Seven Seas Explorer",
};

// Larger image size — request 800px wide thumbnail
const IMG_WIDTH = 800;

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

async function updateShipImage(apiBase, apiKey, shipName, imageUrl, imageCaption, dryRun) {
  if (dryRun) return true;

  const resp = await fetch(`${apiBase}/api/ship-metadata`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({
      ships: [{ name: shipName, image_url: imageUrl, image_caption: imageCaption }],
    }),
  });

  if (resp.status === 401) {
    console.error("\n❌ 401 Unauthorized — check your --key");
    process.exit(1);
  }

  return resp.ok;
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
    console.log("⏭  no Wikipedia article");
    skipped++;
    continue;
  }

  try {
    const result = await fetchWikiImage(articleTitle);

    if (!result.found) {
      console.log(`❌ ${result.reason}`);
      missing++;
      continue;
    }

    const ok = await updateShipImage(apiBase, apiKey, shipName, result.imageUrl, result.caption, dryRun);

    if (ok) {
      console.log(`✅ ${result.articleTitle}`);
      if (dryRun) console.log(`      → ${result.imageUrl}`);
      found++;
    } else {
      console.log(`❌ API write failed`);
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
