#!/usr/bin/env node
/**
 * Harborwatch PDF Importer — v2
 *
 * Improvements over v1:
 *  - Auto-discovers PDF links by scraping the year's schedule page
 *  - Scrapes the 3 reference PDFs: Berth Codes, Port Codes, Ship Codes
 *  - Falls back to constructed URL patterns if auto-discovery misses a port
 *  - Handles VDZ-style "-1" suffix and other filename variants automatically
 *
 * Usage:
 *   node import-pdfs.mjs [--year 2026] [--api http://localhost:8000] [--port JNU]
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Use the lib directly to avoid pdf-parse's isDebugMode file check
let pdfParse;
try {
  pdfParse = require("./node_modules/pdf-parse/lib/pdf-parse.js");
} catch {
  try { pdfParse = require("pdf-parse"); } catch {
    console.error("pdf-parse not found. Run: npm install pdf-parse");
    process.exit(1);
  }
}

// ── Year page URLs ──────────────────────────────────────────────────────────
const YEAR_PAGES = {
  2025: "https://claalaska.com/?page_id=665",
  2026: "https://claalaska.com/?page_id=1551",
  2027: "https://claalaska.com/?page_id=1250",
};

// ── Fallback port name map ──────────────────────────────────────────────────
const PORT_NAMES = {
  ANC:"Anchorage",      CDV:"Cordova",           CFJ:"College Fjord",
  DH:"Dutch Harbor",    GB:"Glacier Bay",         HNS:"Haines",
  HOM:"Homer",          HUB:"Hubbard Glacier",    ISP:"Icy Strait Point",
  JNU:"Juneau",         KAK:"Kake",               KDK:"Kodiak",
  KFJ:"Kenai Fjords",   KLW:"Klawock",            KTN:"Ketchikan",
  MET:"Metlakatla",     MFJ:"Misty Fjords",       NOM:"Nome",
  PDH:"Prudhoe Bay",    PTB:"Petersburg",          SEA:"Seattle",
  SEW:"Seward",         SFO:"San Francisco",       SIT:"Sitka",
  SKG:"Skagway",        TA:"Tracy Arm-Endicott Arm",
  VAN:"Vancouver",      VDZ:"Valdez",              VIC:"Victoria",
  WHT:"Whittier",       WRG:"Wrangell",
};

const MONTH_MAP = {
  January:"01",February:"02",March:"03",April:"04",
  May:"05",June:"06",July:"07",August:"08",
  September:"09",October:"10",November:"11",December:"12",
};
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Discover all PDF URLs from the schedule page ────────────────────────────
async function discoverPdfLinks(year) {
  const portPdfs = {}, referencePdfs = {};
  let masterPdf = null;

  const pageUrl = YEAR_PAGES[year];
  if (!pageUrl) return { portPdfs, referencePdfs, masterPdf };

  let html = "";
  try {
    const resp = await fetch(pageUrl, { headers: { "User-Agent": "cruise-scraper/2.0" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (e) {
    console.warn(`  ⚠️  Page fetch failed: ${e.message} — will use fallback URLs`);
    return { portPdfs, referencePdfs, masterPdf };
  }

  const linkRe = /href="(https?:\/\/claalaska\.com\/[^"]+\.pdf)"/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1];
    const filename = url.split("/").pop();

    if (/^1[.\-_]berth/i.test(filename))       { referencePdfs.berth = url; continue; }
    if (/^2[.\-_]port/i.test(filename))         { referencePdfs.port  = url; continue; }
    if (/^3[.\-_]ship/i.test(filename))         { referencePdfs.ship  = url; continue; }
    if (/all.?ports.?all.?vessels/i.test(filename)) { masterPdf = url; continue; }

    // Extract port code: 1-3 uppercase letters before the first dash
    const codeM = filename.match(/^([A-Za-z]{1,3})-/i);
    if (codeM) {
      const code = codeM[1].toUpperCase();
      if (!portPdfs[code]) portPdfs[code] = url;
    }
  }

  // Fallback: try known master PDF URL patterns if not found on page
  if (!masterPdf && year === 2025) {
    masterPdf = "https://claalaska.com/wp-content/uploads/2025/05/Alaska-All-Ports-All-Vessels-2025.pdf";
  }

  return { portPdfs, referencePdfs, masterPdf };
}

// ── Fetch a PDF as a Buffer ─────────────────────────────────────────────────
async function fetchPdfBuffer(url) {
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "cruise-scraper/2.0" } });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

// ── Reference PDF parsers ───────────────────────────────────────────────────
async function parseReferencePdf(url, type = "berth") {
  const codes = {};
  const buf = await fetchPdfBuffer(url);
  if (!buf) return codes;
  try {
    const { text } = await pdfParse(buf);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip header lines
      if (line.includes('Cruise Line Agencies') ||
          line.includes('Codes') ||
          line.match(/^(PORT|SHIP|BRTH)/)) continue;

      if (type === "berth") {
        // Format: PORTCODE(3) + BRTHCODE(3) + BERTH_NAME
        // Example: "ANCCTYCITY DOCK" → CTY: "CITY DOCK"
        const m = line.match(/^[A-Z]{3}([A-Z]{3})(.+)$/);
        if (m) codes[m[1]] = m[2].trim();
      }
      else if (type === "port") {
        // Format: PORT_NAME + CODE(3) + SERVICES
        // Example: "ANCHORAGEANCBGP" → ANC: "ANCHORAGE"
        // Extract the 3-letter code by finding where uppercase letters are followed by uppercase
        const m = line.match(/^([A-Z\s]+?)([A-Z]{3})([A-Z]+)$/);
        if (m && m[2].length === 3) {
          codes[m[2]] = m[1].trim();
        }
      }
      else if (type === "ship") {
        // Format: SHIP_NAME + CODE(3-4) + DIGITS + LETTERS + CRUISE_LINE
        // Example: "AMSTERDAMAMD14600GTBPRHOLLAND AMERICA LINE"
        // Find where digits start after initial text
        const m = line.match(/^(.+?)([A-Z]{3,4})(\d+[A-Z]+.*)$/);
        if (m) {
          const shipName = m[1].trim();
          const shipCode = m[2];
          // Extract cruise line from the end
          const rest = m[3];
          const lineMatch = rest.match(/([A-Z\s]+(?:LINE|CRUISES|CRUISE))$/i);
          const cruiseLine = lineMatch ? lineMatch[1].trim() : "";
          codes[shipCode] = cruiseLine || shipName;
        }
      }
    }
  } catch { /* silent */ }
  return codes;
}

// ── Schedule PDF text parser ────────────────────────────────────────────────
function parseDateToISO(dateStr, year) {
  const m = dateStr.match(/(\w+),\s+(\w+)\s+(\d+)/);
  if (!m) return "";
  const mm = MONTH_MAP[m[2]] ?? "01";
  const dd = String(parseInt(m[3])).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Parse master "All Ports All Vessels" PDF where port codes are embedded in each entry
function parseMasterPdfText(text, year) {
  const results = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const SKIP = ["Cruise Line Agencies","Cruise Ship Calendar","FOR PORT","AND VOYAGES","AND SHIP","Page "];
  const DATE_RE = new RegExp(
    `((${DAY_NAMES.join("|")}),\\s+(?:${Object.keys(MONTH_MAP).join("|")})\\s+\\d{1,2})`, "g"
  );
  const timeRe = /^(\d{1,2}:\d{2})\s*(\d{1,2}:\d{2})\s*([A-Z]{2,5})?$/;

  const isDate = l => DAY_NAMES.some(d => l.startsWith(d + ",")) && Object.keys(MONTH_MAP).some(mn => l.includes(mn));
  const extractDates = l => [...l.matchAll(DATE_RE)].map(m => m[1]);
  const cleanName = raw => {
    const cut = raw.search(new RegExp(`\\s+(${DAY_NAMES.join("|")}),\\s+`, "i"));
    return (cut > 0 ? raw.slice(0, cut) : raw).trim().toUpperCase();
  };

  let currentDate = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.some(s => line.includes(s))) continue;
    if (/^\d{2}:\d{2}\s+\w+day,/.test(line)) continue; // page timestamp

    if (isDate(line)) {
      const dates = extractDates(line);
      if (dates.length) currentDate = dates[dates.length - 1];
      continue;
    }
    if (!currentDate) continue;

    const tm = line.match(timeRe);
    if (!tm) continue;

    let [, arrival, departure, berthCode = null] = tm;

    // Berth code on its own next line
    if (!berthCode && i + 1 < lines.length && /^[A-Z]{2,5}$/.test(lines[i + 1])) {
      berthCode = lines[i + 1]; i++;
    }

    // Find ship line with embedded port code
    let j = i + 1;
    while (j < lines.length && lines[j] === "") j++;
    if (j >= lines.length) continue;

    let portCode = null, portName = null, shipName = null;

    // Skip "-" separator if present
    if (lines[j] === "-") j++;
    if (j >= lines.length) continue;

    // Format: "PORTCODESHIP_NAME" - extract port code (2-4 letters) and ship name
    const portShipMatch = lines[j].match(/^([A-Z]{2,4})([A-Z\s].*)$/);
    if (portShipMatch) {
      const possiblePort = portShipMatch[1];
      const possibleShip = portShipMatch[2];

      // Try matching against known port codes
      if (PORT_NAMES[possiblePort]) {
        portCode = possiblePort;
        portName = PORT_NAMES[possiblePort];
        shipName = cleanName(possibleShip);
      } else {
        // If not a known port, try 3-letter code (most common)
        const port3 = possiblePort.slice(0, 3);
        const port2 = possiblePort.slice(0, 2);

        if (PORT_NAMES[port3]) {
          portCode = port3;
          portName = PORT_NAMES[port3];
          shipName = cleanName(possiblePort.slice(3) + possibleShip);
        } else if (PORT_NAMES[port2]) {
          portCode = port2;
          portName = PORT_NAMES[port2];
          shipName = cleanName(possiblePort.slice(2) + possibleShip);
        } else {
          // Default to 3-letter code
          portCode = port3;
          portName = port3;
          shipName = cleanName(possiblePort.slice(3) + possibleShip);
        }
      }

      i = j;
    }

    if (!shipName) continue;

    // Check for trailing date
    const trailing = extractDates(lines[j]);
    const nextDate = trailing.length ? trailing[trailing.length - 1] : null;

    results.push({
      year, port_code: portCode, port_name: portName,
      ship_name: shipName, date_str: currentDate,
      date_iso: parseDateToISO(currentDate, year),
      arrival_time: arrival, departure_time: departure,
      berth_code: berthCode, day_of_week: currentDate.split(",")[0],
    });

    if (nextDate) currentDate = nextDate;
  }
  return results;
}

function parsePdfText(text, portCode, portName, year) {
  const results = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const SKIP = ["Cruise Line Agencies","Cruise Ship Calendar","FOR PORT","AND VOYAGES","AND SHIP","Page "];
  const DATE_RE = new RegExp(
    `((${DAY_NAMES.join("|")}),\\s+(?:${Object.keys(MONTH_MAP).join("|")})\\s+\\d{1,2})`, "g"
  );
  const timeRe = /^(\d{1,2}:\d{2})\s*(\d{1,2}:\d{2})\s*([A-Z]{2,5})?$/;

  const isDate = l => DAY_NAMES.some(d => l.startsWith(d + ",")) && Object.keys(MONTH_MAP).some(mn => l.includes(mn));
  const extractDates = l => [...l.matchAll(DATE_RE)].map(m => m[1]);
  const cleanName = raw => {
    const cut = raw.search(new RegExp(`\\s+(${DAY_NAMES.join("|")}),\\s+`, "i"));
    return (cut > 0 ? raw.slice(0, cut) : raw).trim().toUpperCase();
  };

  let currentDate = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.some(s => line.includes(s))) continue;
    if (/^\d{2}:\d{2}\s+\w+day,/.test(line)) continue; // page timestamp

    if (isDate(line)) {
      const dates = extractDates(line);
      if (dates.length) currentDate = dates[dates.length - 1];
      continue;
    }
    if (!currentDate) continue;

    const tm = line.match(timeRe);
    if (!tm) continue;

    let [, arrival, departure, berthCode = null] = tm;

    // Berth code on its own next line
    if (!berthCode && i + 1 < lines.length && /^[A-Z]{2,5}$/.test(lines[i + 1])) {
      berthCode = lines[i + 1]; i++;
    }

    // Find ship line: either "- PORT SHIP" format or "-" on one line followed by "PORTSHIP" on next
    let j = i + 1;
    while (j < lines.length && lines[j] === "") j++;
    if (j >= lines.length) continue;

    let shipName = null;

    // Format 1: "- PORT SHIP" on one line
    const dashLineMatch = lines[j].match(/^-\s+[A-Z]{1,4}\s+(.+)$/);
    if (dashLineMatch) {
      shipName = cleanName(dashLineMatch[1]);
      i = j;
    }
    // Format 2: "-" on one line, "PORTSHIP" on next line
    else if (lines[j] === "-" && j + 1 < lines.length) {
      // Port codes can be 2-4 letters (e.g., GB, JNU, etc.)
      // Match the known port code length to avoid eating the first letter of ship name
      const portShipMatch = lines[j + 1].match(new RegExp(`^${portCode}(.+)$`));
      if (portShipMatch) {
        shipName = cleanName(portShipMatch[1]);
        i = j + 1;
      }
    }

    if (!shipName) continue;

    // Trailing date → advances currentDate after this record
    // Check the line that contains the ship name for a trailing date
    const shipLine = dashLineMatch ? lines[j] : lines[j + 1];
    const trailing = extractDates(shipLine);
    const nextDate = trailing.length ? trailing[trailing.length - 1] : null;

    results.push({
      year, port_code: portCode, port_name: portName,
      ship_name: shipName, date_str: currentDate,
      date_iso: parseDateToISO(currentDate, year),
      arrival_time: arrival, departure_time: departure,
      berth_code: berthCode, day_of_week: currentDate.split(",")[0],
    });

    if (nextDate) currentDate = nextDate;
  }
  return results;
}

// ── API helpers ─────────────────────────────────────────────────────────────
async function importRecords(apiBase, records, apiKey) {
  const resp = await fetch(`${apiBase}/api/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({ records }),
  });
  return resp.json();
}

async function importReference(apiBase, type, codes, apiKey) {
  if (!Object.keys(codes).length) return;
  try {
    const url = `${apiBase}/api/reference`;
    const payload = { type, codes };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const r = await resp.json();
      console.log(`  ✅ ${type} codes: ${r.count ?? Object.keys(codes).length} entries stored`);
    } else if (resp.status === 401) {
      console.log(`  ❌ ${type} codes: 401 Unauthorized — check your --key value`);
    } else {
      const errText = await resp.text().catch(() => "");
      console.log(`  ⚠️  ${type} codes: HTTP ${resp.status} — ${errText.substring(0, 100)}`);
    }
  } catch (e) {
    console.log(`  ⚠️  ${type} codes import error: ${e.constructor.name}: ${e.message}`);
    console.log(`     Stack: ${e.stack?.split('\n')[1]?.trim() ?? 'no stack'}`);
  }
}

// ── Main scrape ─────────────────────────────────────────────────────────────
async function scrapeYear(year, apiBase, portFilter, apiKey) {
  console.log(`\n🔍 Discovering links on ${YEAR_PAGES[year] ?? "unknown page"}...`);
  const { portPdfs, referencePdfs, masterPdf } = await discoverPdfLinks(year);
  console.log(`   ${Object.keys(portPdfs).length} port PDFs | ${Object.keys(referencePdfs).length} reference PDFs${masterPdf ? " | master PDF" : ""}`);

  // Reference PDFs
  if (referencePdfs.berth) {
    process.stdout.write("\n  📋 Berth codes... ");
    const c = await parseReferencePdf(referencePdfs.berth, "berth");
    console.log(`${Object.keys(c).length} codes`);
    await importReference(apiBase, "berth", c, apiKey);
  }
  if (referencePdfs.port) {
    process.stdout.write("  📋 Port codes...  ");
    const c = await parseReferencePdf(referencePdfs.port, "port");
    console.log(`${Object.keys(c).length} codes`);
    await importReference(apiBase, "port", c, apiKey);
  }
  if (referencePdfs.ship) {
    process.stdout.write("  📋 Ship codes...  ");
    const c = await parseReferencePdf(referencePdfs.ship, "ship");
    console.log(`${Object.keys(c).length} codes`);
    await importReference(apiBase, "ship", c, apiKey);
  }

  // Try master PDF first if available (for years like 2025 with only master PDF)
  const allRecords = [];
  let ok = 0, fail = 0;

  if (masterPdf && !portFilter) {
    console.log(`\n🛳️  Scraping master PDF...\n`);
    process.stdout.write(`  📄 All Ports All Vessels... `);
    const buf = await fetchPdfBuffer(masterPdf);
    if (buf) {
      let parsed;
      try {
        parsed = await pdfParse(buf);
        const recs = parseMasterPdfText(parsed.text, year);
        if (recs.length) {
          allRecords.push(...recs);
          const portCounts = {};
          recs.forEach(r => portCounts[r.port_code] = (portCounts[r.port_code] || 0) + 1);
          console.log(`✅ ${recs.length} calls across ${Object.keys(portCounts).length} ports`);
          console.log(`\n📊 ${allRecords.length} total calls\n`);
        } else {
          console.log(`❌ no data parsed`);
        }
      } catch (e) {
        console.log(`❌ parse error: ${e.message}`);
      }
    } else {
      console.log(`❌ fetch failed`);
    }
  }

  // If master PDF was successful, skip individual port scraping
  if (allRecords.length > 0 && !portFilter) {
    // Master PDF already has all data
  } else {
    // Port schedule PDFs (individual port files)
    console.log(`\n🛳️  Scraping schedules...\n`);
    const portsToScrape = portFilter
      ? [portFilter.toUpperCase()]
      : [...new Set([...Object.keys(portPdfs), ...Object.keys(PORT_NAMES)])];

    ok = 0; fail = 0;

    for (const code of portsToScrape.sort()) {
    const portName = PORT_NAMES[code] ?? code;
    process.stdout.write(`  ${code.padEnd(4)} ${portName.padEnd(26)}`);

    // Candidates: discovered URL first, then fallback patterns
    const cands = portPdfs[code] ? [portPdfs[code]] : [];
    if (!cands.length) {
      const base = `https://claalaska.com/wp-content/uploads/${year}`;
      const slug = portName.replace(/\s+/g, "-");
      for (const mo of ["04", "06", "03", "05"]) {
        cands.push(`${base}/${mo}/${code}-${slug}-${year}.pdf`);
        cands.push(`${base}/${mo}/${code}-${slug}-${year}-1.pdf`);
      }
    }

    let found = false;
    for (const url of cands) {
      const buf = await fetchPdfBuffer(url);
      if (!buf) continue;
      let parsed;
      try { parsed = await pdfParse(buf); } catch { continue; }
      const recs = parsePdfText(parsed.text, code, portName, year);
      if (recs.length) {
        allRecords.push(...recs);
        console.log(`✅ ${recs.length}`);
        ok++; found = true; break;
      }
    }
    if (!found) { console.log("❌"); fail++; }
  }

    console.log(`\n📊 ${allRecords.length} total calls | ${ok} ports OK | ${fail} failed\n`);
  }

  if (allRecords.length) {
    process.stdout.write(`📤 Importing to API... `);
    const r = await importRecords(apiBase, allRecords, apiKey);
    console.log(`inserted: ${r.inserted}, dupes skipped: ${r.skipped}`);
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let year = 2026, apiBase = "http://localhost:8000", portFilter, apiKey;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--year") year      = parseInt(args[++i]);
  if (args[i] === "--api")  apiBase   = args[++i];
  if (args[i] === "--port") portFilter = args[++i];
  if (args[i] === "--key")  apiKey    = args[++i];
}

// Also accept key from environment variable
apiKey = apiKey ?? process.env.HARBORWATCH_API_KEY ?? undefined;

console.log(`⚓ Harborwatch Scraper v2`);
console.log(`   Year: ${year}  |  API: ${apiBase}  |  Port: ${portFilter ?? "ALL"}  |  Auth: ${apiKey ? "✅ key set" : "none (local dev)"}`);
scrapeYear(year, apiBase, portFilter, apiKey).catch(console.error);
