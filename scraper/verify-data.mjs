#!/usr/bin/env node
/**
 * Data Verification Script
 * Compares scraped database data against source PDFs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("./node_modules/pdf-parse/lib/pdf-parse.js");

async function fetchPdfText(url) {
  const resp = await fetch(url, { headers: { "User-Agent": "cruise-scraper/2.0" } });
  if (!resp.ok) return null;
  const buffer = Buffer.from(await resp.arrayBuffer());
  const { text } = await pdfParse(buffer);
  return text;
}

// Verify Juneau May 1-2, 2027
console.log("📄 Fetching JNU PDF for 2027...\n");
const pdfUrl = "https://claalaska.com/wp-content/uploads/2026/04/JNU-Juneau-2027.pdf";
const text = await fetchPdfText(pdfUrl);

if (!text) {
  console.error("Failed to fetch PDF");
  process.exit(1);
}

// Parse the PDF to extract May 1-2 data
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

console.log("🔍 Searching PDF for Saturday, May 1 and Sunday, May 2...\n");

let inMay1 = false;
let inMay2 = false;
const may1Data = [];
const may2Data = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Look for "Saturday, May 1" (not May 10, 11, etc.)
  if (line.match(/Saturday,\s+May\s+1\D/i)) {
    inMay1 = true;
    may1Data.push(`[Line ${i}] ${line}`);
    continue;
  }

  // Look for "Sunday, May 2" (not May 20, 21, etc.)
  if (line.match(/Sunday,\s+May\s+2\D/i)) {
    inMay1 = false;
    inMay2 = true;
    may2Data.push(`[Line ${i}] ${line}`);
    continue;
  }

  // Look for next date to stop capturing
  if (line.match(/Monday,\s+May\s+3/i)) {
    break;
  }

  if (inMay1) {
    may1Data.push(`[Line ${i}] ${line}`);
  }
  if (inMay2) {
    may2Data.push(`[Line ${i}] ${line}`);
  }
}

console.log("📄 PDF DATA:");
console.log("=".repeat(60));
console.log("\nSaturday, May 1:");
may1Data.forEach(line => console.log("  " + line));

console.log("\nSunday, May 2:");
may2Data.forEach(line => console.log("  " + line));

console.log("\n" + "=".repeat(60));
console.log("💾 DATABASE DATA:");
console.log("=".repeat(60) + "\n");

const apiResp = await fetch("http://localhost:8000/api/schedule?port=JNU&date_from=2027-05-01&date_to=2027-05-02&limit=20");
const { data } = await apiResp.json();

data.forEach(record => {
  console.log(`${record.date_str}:`);
  console.log(`  Ship: ${record.ship_name}`);
  console.log(`  Times: ${record.arrival_time} - ${record.departure_time}`);
  console.log(`  Berth: ${record.berth_code || 'N/A'}`);
  console.log();
});

console.log("=".repeat(60));
console.log("✅ MANUAL VERIFICATION:");
console.log("=".repeat(60));
console.log("Compare the PDF lines above with the database records.");
console.log("Expected format in PDF:");
console.log("  - Date line");
console.log("  - Time line (arrival/departure)");
console.log("  - Dash (-)");
console.log("  - PORTSHIP_NAME line");
