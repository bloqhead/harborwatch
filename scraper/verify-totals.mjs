#!/usr/bin/env node
/**
 * Comprehensive Data Verification
 *
 * This script helps verify scraped data accuracy by:
 * 1. Comparing total counts (DB vs what we just scraped)
 * 2. Showing statistics by port
 * 3. Providing sample records for manual spot-checking
 */

const YEAR = process.argv[2] || 2027;

console.log(`⚓ Data Verification for ${YEAR}`);
console.log("=".repeat(70) + "\n");

// Get database stats
const statsResp = await fetch(`http://localhost:8000/api/stats?year=${YEAR}`);
const stats = await statsResp.json();

console.log("📊 DATABASE STATISTICS:");
console.log("-".repeat(70));
console.log(`Total Port Calls: ${stats.totalCalls}`);
console.log(`Unique Ships: ${stats.uniqueShips}`);
console.log(`Unique Ports: ${stats.uniquePorts}`);
console.log();

// Top 10 ports by visit count
console.log("🏆 TOP 10 BUSIEST PORTS:");
console.log("-".repeat(70));
stats.allPorts.slice(0, 10).forEach((port, i) => {
  const code = port.code.padEnd(5);
  const name = port.name.padEnd(25);
  const calls = String(port.calls).padStart(4);
  console.log(`${String(i + 1).padStart(2)}. ${code} ${name} ${calls} calls`);
});
console.log();

// Top 10 ships by visit count
console.log("🚢 TOP 10 MOST ACTIVE SHIPS:");
console.log("-".repeat(70));
stats.topShips.forEach((ship, i) => {
  const name = ship.name.padEnd(30);
  const calls = String(ship.calls).padStart(4);
  console.log(`${String(i + 1).padStart(2)}. ${name} ${calls} visits`);
});
console.log();

// Monthly breakdown
console.log("📅 VISITS BY MONTH:");
console.log("-".repeat(70));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
stats.byMonth.forEach(m => {
  const month = months[m.month - 1].padEnd(4);
  const bar = '█'.repeat(Math.floor(m.calls / 20));
  console.log(`${month} ${String(m.calls).padStart(4)} ${bar}`);
});
console.log();

// Get a random sample for manual verification
console.log("🔍 RANDOM SAMPLE FOR MANUAL VERIFICATION:");
console.log("-".repeat(70));
console.log("Pick any of these and verify against the source PDF:\n");

const sampleResp = await fetch(`http://localhost:8000/api/schedule?year=${YEAR}&limit=5&page=${Math.floor(Math.random() * 10) + 1}`);
const { data: samples } = await sampleResp.json();

samples.forEach(record => {
  console.log(`${record.date_str} | Port: ${record.port_code} (${record.port_name})`);
  console.log(`  Ship: ${record.ship_name}`);
  console.log(`  Times: ${record.arrival_time} → ${record.departure_time}`);
  console.log(`  Berth: ${record.berth_code || 'N/A'}`);
  console.log(`  ✓ Verify in: ${record.port_code}-${record.port_name.replace(/\s+/g, '-')}-${YEAR}.pdf`);
  console.log();
});

console.log("=".repeat(70));
console.log("📝 VERIFICATION CHECKLIST:");
console.log("=".repeat(70));
console.log("1. Total calls matches expectation (~4,000-5,000 for Alaska)");
console.log("2. Top ports are major cruise destinations (JNU, KTN, SKG, SEA, VAN)");
console.log("3. Peak season is May-September (shown in monthly breakdown)");
console.log("4. Manual spot-check: Pick 3-5 random samples above and verify");
console.log("   against source PDFs at https://claalaska.com");
console.log();
console.log("💡 To verify a specific port:");
console.log(`   node verify-port.mjs ${YEAR} JNU`);
console.log();
