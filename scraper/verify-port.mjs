#!/usr/bin/env node
/**
 * Port-Specific Verification
 * Downloads a port PDF and compares total count with database
 *
 * Usage: node verify-port.mjs 2027 KTN
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("./node_modules/pdf-parse/lib/pdf-parse.js");

const YEAR = parseInt(process.argv[2]) || 2027;
const PORT = (process.argv[3] || "JNU").toUpperCase();

console.log(`🔍 Verifying ${PORT} for ${YEAR}...\n`);

// Get port info from database
const portResp = await fetch(`http://localhost:8000/api/port/${PORT}?year=${YEAR}`);
if (!portResp.ok) {
  console.error(`❌ Port ${PORT} not found in database for ${YEAR}`);
  process.exit(1);
}

const portData = await portResp.json();
const dbCount = portData.totalCalls;
const portName = portData.code;

console.log("💾 DATABASE:");
console.log(`   Port: ${portData.code}`);
console.log(`   Total Calls: ${dbCount}`);
console.log(`   Unique Ships: ${portData.uniqueShips}`);
console.log(`   Season: ${portData.firstCall} to ${portData.lastCall}`);
console.log();

// Try to fetch the PDF
const yearFolder = YEAR === 2027 ? "2026" : String(YEAR);
const pdfUrl = `https://claalaska.com/wp-content/uploads/${yearFolder}/04/${PORT}-*-${YEAR}.pdf`;

console.log("📄 PDF VERIFICATION:");
console.log(`   Looking for PDF at claalaska.com...`);

// Discover the actual PDF URL
const pageUrl = YEAR === 2027
  ? "https://claalaska.com/?page_id=1250"
  : YEAR === 2026
  ? "https://claalaska.com/?page_id=1551"
  : null;

if (!pageUrl) {
  console.log(`   ⚠️  No schedule page configured for ${YEAR}`);
  process.exit(0);
}

const pageResp = await fetch(pageUrl);
const html = await pageResp.text();
const linkMatch = html.match(new RegExp(`href="(https://claalaska.com[^"]*${PORT}[^"]*\\.pdf)"`, 'i'));

if (!linkMatch) {
  console.log(`   ⚠️  PDF not found for ${PORT} (port may have no cruises in ${YEAR})`);
  process.exit(0);
}

const actualPdfUrl = linkMatch[1];
console.log(`   Found: ${actualPdfUrl.split('/').pop()}`);

// Download and parse PDF
const pdfResp = await fetch(actualPdfUrl, { headers: { "User-Agent": "cruise-scraper/2.0" } });
const buffer = Buffer.from(await pdfResp.arrayBuffer());
const { text } = await pdfParse(buffer);

// Count ship entries in PDF (lines starting with PORT code after a dash)
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
let pdfCount = 0;

for (let i = 0; i < lines.length; i++) {
  // Format: dash on one line, then PORTSHIP on next
  if (lines[i] === '-' && i + 1 < lines.length) {
    const nextLine = lines[i + 1];
    // Check if it starts with our port code
    if (nextLine.startsWith(PORT)) {
      pdfCount++;
    }
  }
}

console.log(`   Entries counted in PDF: ${pdfCount}`);
console.log();

// Compare
console.log("=".repeat(60));
if (pdfCount === dbCount) {
  console.log("✅ VERIFICATION PASSED!");
  console.log(`   Both PDF and database show ${pdfCount} port calls.`);
} else {
  console.log("⚠️  COUNT MISMATCH!");
  console.log(`   PDF: ${pdfCount} entries`);
  console.log(`   DB:  ${dbCount} entries`);
  console.log(`   Difference: ${Math.abs(pdfCount - dbCount)}`);
  console.log();
  console.log("   Possible reasons:");
  console.log("   - PDF parsing may have missed some entries");
  console.log("   - Formatting differences in the PDF");
  console.log("   - Duplicate dates (same ship, multiple visits per day)");
  console.log();
  console.log("   Recommendation: Manually check the PDF and compare with:");
  console.log(`   curl "http://localhost:8000/api/schedule?port=${PORT}&year=${YEAR}&limit=100"`);
}
console.log("=".repeat(60));
