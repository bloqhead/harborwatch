#!/usr/bin/env node
/**
 * Harborwatch Ship Metadata Enricher
 *
 * Populates the ship_metadata table with IMO numbers, cruise lines,
 * and direct MarineTraffic/VesselFinder URLs for all Alaska cruise ships.
 *
 * IMO numbers are permanent vessel identifiers — they never change.
 * MarineTraffic URLs use their internal shipid which is stable.
 *
 * Usage:
 *   node enrich-ships.mjs --api https://harborwatch-api.onrender.com --key YOUR_KEY
 *   node enrich-ships.mjs  (local dev, no key needed)
 */

// ── Alaska cruise ship metadata ───────────────────────────────────────────────
// Sources: MarineTraffic, VesselFinder, Wikipedia, cruise line websites
// MT URL format: https://www.marinetraffic.com/en/ais/details/ships/shipid:XXXXX
// VF URL format: https://www.vesselfinder.com/vessels/details/IMO

const SHIPS = [
  // ── Holland America Line ──────────────────────────────────────────────────
  {
    name: "EURODAM",
    imo: "9378462", cruise_line: "Holland America Line",
    gross_tonnage: 86273, passengers: 2104, crew: 929,
    year_built: 2008, length_m: 285.6, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:312089",
  },
  {
    name: "NIEUW AMSTERDAM",
    imo: "9378474", cruise_line: "Holland America Line",
    gross_tonnage: 86273, passengers: 2106, crew: 929,
    year_built: 2010, length_m: 285.6, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:363734",
  },
  {
    name: "NIEUW STATENDAM",
    imo: "9756081", cruise_line: "Holland America Line",
    gross_tonnage: 99836, passengers: 2666, crew: 1036,
    year_built: 2018, length_m: 297.3, beam_m: 35.5,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5496060",
  },
  {
    name: "NOORDAM",
    imo: "9230115", cruise_line: "Holland America Line",
    gross_tonnage: 82897, passengers: 1972, crew: 811,
    year_built: 2006, length_m: 285.6, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:265264",
  },
  {
    name: "OOSTERDAM",
    imo: "9221101", cruise_line: "Holland America Line",
    gross_tonnage: 82305, passengers: 1916, crew: 817,
    year_built: 2003, length_m: 285.6, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:245607",
  },
  {
    name: "WESTERDAM",
    imo: "9226891", cruise_line: "Holland America Line",
    gross_tonnage: 82348, passengers: 1916, crew: 817,
    year_built: 2004, length_m: 285.6, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:246030",
  },
  {
    name: "ZAANDAM",
    imo: "9156515", cruise_line: "Holland America Line",
    gross_tonnage: 61396, passengers: 1432, crew: 615,
    year_built: 2000, length_m: 237.9, beam_m: 32.2,
    flag: "Netherlands", homeport: "Rotterdam",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:210804",
  },
  // ── Princess Cruises ──────────────────────────────────────────────────────
  {
    name: "CORAL PRINCESS",
    imo: "9228344", cruise_line: "Princess Cruises",
    gross_tonnage: 91627, passengers: 2590, crew: 895,
    year_built: 2002, length_m: 294.0, beam_m: 32.2,
    flag: "Bermuda", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:249793",
  },
  {
    name: "DISCOVERY PRINCESS",
    imo: "9838444", cruise_line: "Princess Cruises",
    gross_tonnage: 145281, passengers: 3660, crew: 1346,
    year_built: 2022, length_m: 330.0, beam_m: 37.2,
    flag: "Bermuda", homeport: "Los Angeles",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:9552036",
  },
  {
    name: "EMERALD PRINCESS",
    imo: "9333151", cruise_line: "Princess Cruises",
    gross_tonnage: 113561, passengers: 3114, crew: 1200,
    year_built: 2007, length_m: 290.2, beam_m: 36.0,
    flag: "Bermuda", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:311887",
  },
  {
    name: "GRAND PRINCESS",
    imo: "9162282", cruise_line: "Princess Cruises",
    gross_tonnage: 107517, passengers: 2590, crew: 1100,
    year_built: 1998, length_m: 290.2, beam_m: 36.0,
    flag: "Bermuda", homeport: "San Francisco",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:211108",
  },
  {
    name: "ISLAND PRINCESS",
    imo: "9228332", cruise_line: "Princess Cruises",
    gross_tonnage: 91627, passengers: 2590, crew: 895,
    year_built: 2003, length_m: 294.0, beam_m: 32.2,
    flag: "Bermuda", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:249794",
  },
  {
    name: "RUBY PRINCESS",
    imo: "9378701", cruise_line: "Princess Cruises",
    gross_tonnage: 113561, passengers: 3080, crew: 1200,
    year_built: 2008, length_m: 290.2, beam_m: 36.0,
    flag: "Bermuda", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:312107",
  },
  {
    name: "STAR PRINCESS",
    imo: "9862838", cruise_line: "Princess Cruises",
    gross_tonnage: 177800, passengers: 4300, crew: 1600,
    year_built: 2025, length_m: 342.0, beam_m: 38.4,
    flag: "Bermuda", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:9906482",
  },
  // ── Norwegian Cruise Line ─────────────────────────────────────────────────
  {
    name: "NORWEGIAN BLISS",
    imo: "9751509", cruise_line: "Norwegian Cruise Line",
    gross_tonnage: 168028, passengers: 4004, crew: 1716,
    year_built: 2018, length_m: 333.0, beam_m: 41.4,
    flag: "Bahamas", homeport: "Miami",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5481188",
  },
  {
    name: "NORWEGIAN ENCORE",
    imo: "9793045", cruise_line: "Norwegian Cruise Line",
    gross_tonnage: 169145, passengers: 3998, crew: 1735,
    year_built: 2019, length_m: 333.0, beam_m: 41.4,
    flag: "Bahamas", homeport: "Miami",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5657778",
  },
  {
    name: "NORWEGIAN JOY",
    imo: "9745127", cruise_line: "Norwegian Cruise Line",
    gross_tonnage: 167725, passengers: 3900, crew: 1716,
    year_built: 2017, length_m: 333.0, beam_m: 41.4,
    flag: "Bahamas", homeport: "Miami",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5446918",
  },
  // ── Royal Caribbean ───────────────────────────────────────────────────────
  {
    name: "OVATION OF THE SEAS",
    imo: "9682518", cruise_line: "Royal Caribbean",
    gross_tonnage: 168666, passengers: 4180, crew: 1551,
    year_built: 2016, length_m: 347.1, beam_m: 41.4,
    flag: "Bahamas", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5256741",
  },
  {
    name: "RADIANCE OF THE SEAS",
    imo: "9195195", cruise_line: "Royal Caribbean",
    gross_tonnage: 90090, passengers: 2501, crew: 857,
    year_built: 2001, length_m: 293.2, beam_m: 32.2,
    flag: "Bahamas", homeport: "Tampa",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:210760",
  },
  {
    name: "SERENADE OF THE SEAS",
    imo: "9228344", cruise_line: "Royal Caribbean",
    gross_tonnage: 90090, passengers: 2501, crew: 857,
    year_built: 2003, length_m: 293.2, beam_m: 32.2,
    flag: "Bahamas", homeport: "Tampa",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:245625",
  },
  // ── Carnival Cruise Line ──────────────────────────────────────────────────
  {
    name: "CARNIVAL LUMINOSA",
    imo: "9232493", cruise_line: "Carnival Cruise Line",
    gross_tonnage: 92720, passengers: 2826, crew: 1050,
    year_built: 2001, length_m: 294.0, beam_m: 32.2,
    flag: "Panama", homeport: "Brisbane",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:245608",
  },
  {
    name: "CARNIVAL MIRACLE",
    imo: "9232531", cruise_line: "Carnival Cruise Line",
    gross_tonnage: 88500, passengers: 2124, crew: 921,
    year_built: 2004, length_m: 293.5, beam_m: 32.3,
    flag: "Panama", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:245611",
  },
  {
    name: "CARNIVAL SPIRIT",
    imo: "9198216", cruise_line: "Carnival Cruise Line",
    gross_tonnage: 88500, passengers: 2124, crew: 921,
    year_built: 2001, length_m: 293.5, beam_m: 32.3,
    flag: "Panama", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:210756",
  },
  // ── Celebrity Cruises ─────────────────────────────────────────────────────
  {
    name: "CELEBRITY EDGE",
    imo: "9776930", cruise_line: "Celebrity Cruises",
    gross_tonnage: 130818, passengers: 2918, crew: 1320,
    year_built: 2018, length_m: 306.0, beam_m: 39.0,
    flag: "Malta", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5570498",
  },
  {
    name: "CELEBRITY SOLSTICE",
    imo: "9378462", cruise_line: "Celebrity Cruises",
    gross_tonnage: 122400, passengers: 2852, crew: 1253,
    year_built: 2008, length_m: 317.2, beam_m: 36.9,
    flag: "Malta", homeport: "Fort Lauderdale",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:311974",
  },
  // ── Smaller / expedition lines ────────────────────────────────────────────
  {
    name: "NATIONAL GEOGRAPHIC QUEST",
    imo: "9782766", cruise_line: "Lindblad Expeditions",
    gross_tonnage: 2526, passengers: 100, crew: 57,
    year_built: 2017, length_m: 73.8, beam_m: 14.0,
    flag: "Marshall Islands", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5487100",
  },
  {
    name: "NATIONAL GEOGRAPHIC VENTURE",
    imo: "9805327", cruise_line: "Lindblad Expeditions",
    gross_tonnage: 2526, passengers: 100, crew: 57,
    year_built: 2018, length_m: 73.8, beam_m: 14.0,
    flag: "Marshall Islands", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5570620",
  },
  {
    name: "NG SEA BIRD",
    imo: "8960774", cruise_line: "Lindblad Expeditions",
    gross_tonnage: 100, passengers: 62, crew: 22,
    year_built: 1981, length_m: 45.7, beam_m: 9.1,
    flag: "United States", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:211059",
  },
  {
    name: "NG SEA LION",
    imo: "8960762", cruise_line: "Lindblad Expeditions",
    gross_tonnage: 100, passengers: 62, crew: 22,
    year_built: 1982, length_m: 45.7, beam_m: 9.1,
    flag: "United States", homeport: "Seattle",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:211060",
  },
  {
    name: "ROALD AMUNDSEN",
    imo: "9813972", cruise_line: "HX Expeditions",
    gross_tonnage: 20889, passengers: 530, crew: 151,
    year_built: 2019, length_m: 140.0, beam_m: 23.6,
    flag: "Norway", homeport: "Bergen",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5657824",
  },
  {
    name: "SEVEN SEAS EXPLORER",
    imo: "9692626", cruise_line: "Regent Seven Seas",
    gross_tonnage: 55254, passengers: 750, crew: 542,
    year_built: 2016, length_m: 224.0, beam_m: 31.8,
    flag: "Bahamas", homeport: "Monte Carlo",
    mt_url: "https://www.marinetraffic.com/en/ais/details/ships/shipid:5296791",
  },
];

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let apiBase = "http://localhost:8000", apiKey;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--api") apiBase = args[++i];
  if (args[i] === "--key") apiKey  = args[++i];
}
apiKey = apiKey ?? process.env.HARBORWATCH_API_KEY;

console.log(`⚓ Harborwatch Ship Enrichment`);
console.log(`   API:  ${apiBase}`);
console.log(`   Ships: ${SHIPS.length} entries`);
console.log(`   Auth: ${apiKey ? "✅ key set" : "none (local dev)"}\n`);

const headers = {
  "Content-Type": "application/json",
  ...(apiKey ? { "x-api-key": apiKey } : {}),
};

const resp = await fetch(`${apiBase}/api/ship-metadata`, {
  method: "POST",
  headers,
  body: JSON.stringify({ ships: SHIPS }),
});

if (resp.status === 401) {
  console.error("❌ 401 Unauthorized — check your --key");
  process.exit(1);
}

const result = await resp.json();
if (result.success) {
  console.log(`✅ Upserted ${result.upserted} ships`);
} else {
  console.error("❌ Error:", result.error);
}
