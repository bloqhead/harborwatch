import { Application, Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

// ── Database setup ───────────────────────────────────────────────────────────
const DB_PATH = Deno.env.get("DB_PATH") ?? (
  await Deno.stat("/data").then(() => "/data/cruise_data.db").catch(() => "./cruise_data.db")
);
console.log(`📂 Database: ${DB_PATH}`);
const db = new DB(DB_PATH);

db.execute(`
  CREATE TABLE IF NOT EXISTS port_calls (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    year           INTEGER NOT NULL,
    port_code      TEXT    NOT NULL,
    port_name      TEXT    NOT NULL,
    ship_name      TEXT    NOT NULL,
    date_str       TEXT    NOT NULL,
    date_iso       TEXT    NOT NULL,
    arrival_time   TEXT,
    departure_time TEXT,
    berth_code     TEXT,
    day_of_week    TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_year      ON port_calls(year);
  CREATE INDEX IF NOT EXISTS idx_port_code ON port_calls(port_code);
  CREATE INDEX IF NOT EXISTS idx_ship_name ON port_calls(ship_name);
  CREATE INDEX IF NOT EXISTS idx_date_iso  ON port_calls(date_iso);
  CREATE INDEX IF NOT EXISTS idx_berth     ON port_calls(berth_code);

  CREATE TABLE IF NOT EXISTS ports (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ships (
    name            TEXT PRIMARY KEY,
    first_seen_year INTEGER
  );

  -- Reference lookup tables from the 3 CLA PDFs
  CREATE TABLE IF NOT EXISTS ref_berth_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    year        INTEGER
  );

  CREATE TABLE IF NOT EXISTS ref_port_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    year        INTEGER
  );

  CREATE TABLE IF NOT EXISTS ref_ship_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    year        INTEGER
  );
`);

// ── Helpers ──────────────────────────────────────────────────────────────────
function jsonOk(ctx: any, body: unknown) {
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = body;
}

function jsonErr(ctx: any, status: number, msg: string) {
  ctx.response.status = status;
  ctx.response.body = { error: msg };
}

// ── API key auth ─────────────────────────────────────────────────────────────
// Set HARBORWATCH_API_KEY env var on Render to protect write endpoints.
// In local dev, if the var is unset all writes are allowed (open mode).
const API_KEY = Deno.env.get("HARBORWATCH_API_KEY") ?? null;

function requireApiKey(ctx: any): boolean {
  if (!API_KEY) return true; // no key configured → open (local dev)
  const header = ctx.request.headers.get("x-api-key") ?? "";
  if (header === API_KEY) return true;
  jsonErr(ctx, 401, "Unauthorized — valid x-api-key header required");
  return false;
}


const router = new Router();

// GET /health — Render health check
router.get("/health", (ctx) => {
  jsonOk(ctx, { status: "ok", ts: new Date().toISOString() });
});

// GET /api/years
router.get("/api/years", (ctx) => {
  const years = db.query<[number]>(
    "SELECT DISTINCT year FROM port_calls ORDER BY year DESC"
  ).map(([y]) => y);
  jsonOk(ctx, { years });
});

// GET /api/ports  — returns ports that have data in the DB
router.get("/api/ports", (ctx) => {
  const ports = db.query<[string, string]>(
    "SELECT code, name FROM ports ORDER BY name"
  ).map(([code, name]) => ({ code, name }));
  jsonOk(ctx, { ports });
});

// GET /api/ships
router.get("/api/ships", (ctx) => {
  const ships = db.query<[string]>(
    "SELECT DISTINCT ship_name FROM port_calls ORDER BY ship_name"
  ).map(([name]) => name);
  jsonOk(ctx, { ships });
});

// GET /api/berths  — reference berth codes
router.get("/api/berths", (ctx) => {
  const berths = db.query<[string, string]>(
    "SELECT code, description FROM ref_berth_codes ORDER BY code"
  ).map(([code, description]) => ({ code, description }));
  jsonOk(ctx, { berths });
});

// GET /api/schedule — main search/filter endpoint
router.get("/api/schedule", (ctx) => {
  const p   = ctx.request.url.searchParams;
  const year      = p.get("year");
  const port      = p.get("port");
  const ship      = p.get("ship");
  const dateFrom  = p.get("date_from");
  const dateTo    = p.get("date_to");
  const berth     = p.get("berth");
  const dayOfWeek = p.get("day");
  const page      = Math.max(1, parseInt(p.get("page")  || "1"));
  const limit     = Math.min(500, Math.max(1, parseInt(p.get("limit") || "100")));
  const offset    = (page - 1) * limit;

  const conds: string[] = [];
  const vals: (string | number)[] = [];

  if (year)      { conds.push("year = ?");                    vals.push(parseInt(year)); }
  if (port)      { conds.push("port_code = ?");               vals.push(port.toUpperCase()); }
  if (ship)      { conds.push("UPPER(ship_name) LIKE ?");     vals.push(`%${ship.toUpperCase()}%`); }
  if (dateFrom)  { conds.push("date_iso >= ?");               vals.push(dateFrom); }
  if (dateTo)    { conds.push("date_iso <= ?");               vals.push(dateTo); }
  if (berth)     { conds.push("berth_code = ?");              vals.push(berth.toUpperCase()); }
  if (dayOfWeek) { conds.push("day_of_week = ?");             vals.push(dayOfWeek); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  const total = db.query<[number]>(`SELECT COUNT(*) FROM port_calls ${where}`, vals)[0][0];

  const rows = db.query<[number,number,string,string,string,string,string,string|null,string|null,string|null,string]>(
    `SELECT id, year, port_code, port_name, ship_name, date_str, date_iso,
            arrival_time, departure_time, berth_code, day_of_week
     FROM port_calls ${where}
     ORDER BY date_iso ASC, arrival_time ASC
     LIMIT ? OFFSET ?`,
    [...vals, limit, offset]
  ).map(([id,year,port_code,port_name,ship_name,date_str,date_iso,
          arrival_time,departure_time,berth_code,day_of_week]) => ({
    id, year, port_code, port_name, ship_name, date_str, date_iso,
    arrival_time, departure_time, berth_code, day_of_week
  }));

  jsonOk(ctx, { data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// GET /api/stats  — aggregate stats (optionally filtered by year)
router.get("/api/stats", (ctx) => {
  const year = ctx.request.url.searchParams.get("year");
  const where = year ? "WHERE year = ?" : "";
  const vals: number[] = year ? [parseInt(year)] : [];

  const totalCalls  = db.query<[number]>(`SELECT COUNT(*) FROM port_calls ${where}`, vals)[0][0];
  const uniqueShips = db.query<[number]>(`SELECT COUNT(DISTINCT ship_name) FROM port_calls ${where}`, vals)[0][0];
  const uniquePorts = db.query<[number]>(`SELECT COUNT(DISTINCT port_code) FROM port_calls ${where}`, vals)[0][0];

  // ALL ports (not just top 10) for the map
  const allPorts = db.query<[string, string, number]>(
    `SELECT port_code, port_name, COUNT(*) as calls
     FROM port_calls ${where} GROUP BY port_code ORDER BY calls DESC`,
    vals
  ).map(([code, name, calls]) => ({ code, name, calls }));

  const topShips = db.query<[string, number]>(
    `SELECT ship_name, COUNT(*) as calls
     FROM port_calls ${where} GROUP BY ship_name ORDER BY calls DESC LIMIT 15`,
    vals
  ).map(([name, calls]) => ({ name, calls }));

  const byMonth = db.query<[string, number]>(
    `SELECT strftime('%m', date_iso) as month, COUNT(*) as calls
     FROM port_calls ${where} GROUP BY month ORDER BY month`,
    vals
  ).map(([month, calls]) => ({ month: parseInt(month), calls }));

  const byDayOfWeek = db.query<[string, number]>(
    `SELECT day_of_week, COUNT(*) as calls
     FROM port_calls ${where} GROUP BY day_of_week ORDER BY calls DESC`,
    vals
  ).map(([day, calls]) => ({ day, calls }));

  jsonOk(ctx, {
    totalCalls, uniqueShips, uniquePorts,
    topPorts: allPorts.slice(0, 10),   // keep topPorts for backwards compat
    allPorts,                           // full list for map
    topShips,
    byMonth,
    byDayOfWeek,
  });
});

// GET /api/port/:code  — detail for a single port
router.get("/api/port/:code", (ctx) => {
  const code = ctx.params.code?.toUpperCase();
  const year = ctx.request.url.searchParams.get("year");
  if (!code) return jsonErr(ctx, 400, "code required");

  const yearCond = year ? "AND year = ?" : "";
  const vals: (string | number)[] = year ? [code, parseInt(year)] : [code];

  const totalCalls  = db.query<[number]>(`SELECT COUNT(*) FROM port_calls WHERE port_code = ? ${yearCond}`, vals)[0][0];
  const uniqueShips = db.query<[number]>(`SELECT COUNT(DISTINCT ship_name) FROM port_calls WHERE port_code = ? ${yearCond}`, vals)[0][0];

  const topShips = db.query<[string, number]>(
    `SELECT ship_name, COUNT(*) as calls FROM port_calls WHERE port_code = ? ${yearCond}
     GROUP BY ship_name ORDER BY calls DESC LIMIT 10`, vals
  ).map(([name, calls]) => ({ name, calls }));

  const byMonth = db.query<[string, number]>(
    `SELECT strftime('%m', date_iso) as month, COUNT(*) as calls
     FROM port_calls WHERE port_code = ? ${yearCond} GROUP BY month ORDER BY month`, vals
  ).map(([month, calls]) => ({ month: parseInt(month), calls }));

  const firstCall = db.query<[string]>(`SELECT MIN(date_iso) FROM port_calls WHERE port_code = ? ${yearCond}`, vals)[0]?.[0];
  const lastCall  = db.query<[string]>(`SELECT MAX(date_iso) FROM port_calls WHERE port_code = ? ${yearCond}`, vals)[0]?.[0];

  jsonOk(ctx, { code, totalCalls, uniqueShips, topShips, byMonth, firstCall, lastCall });
});

// POST /api/import — bulk import port call records (requires API key in production)
router.post("/api/import", async (ctx) => {
  if (!requireApiKey(ctx)) return;
  const body = await ctx.request.body.json();
  const { records } = body;

  if (!Array.isArray(records)) return jsonErr(ctx, 400, "Expected { records: [...] }");

  let inserted = 0, skipped = 0;
  db.execute("BEGIN TRANSACTION");
  try {
    for (const r of records) {
      db.query("INSERT OR IGNORE INTO ports (code, name) VALUES (?, ?)", [r.port_code, r.port_name]);
      db.query("INSERT OR IGNORE INTO ships (name, first_seen_year) VALUES (?, ?)", [r.ship_name, r.year]);

      const exists = db.query<[number]>(
        `SELECT COUNT(*) FROM port_calls
         WHERE year=? AND port_code=? AND ship_name=? AND date_iso=? AND arrival_time=?`,
        [r.year, r.port_code, r.ship_name, r.date_iso, r.arrival_time ?? ""]
      )[0][0];

      if (exists === 0) {
        db.query(
          `INSERT INTO port_calls (year,port_code,port_name,ship_name,date_str,date_iso,
                                   arrival_time,departure_time,berth_code,day_of_week)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.year,r.port_code,r.port_name,r.ship_name,r.date_str,r.date_iso,
           r.arrival_time,r.departure_time,r.berth_code,r.day_of_week]
        );
        inserted++;
      } else { skipped++; }
    }
    db.execute("COMMIT");
    jsonOk(ctx, { success: true, inserted, skipped });
  } catch (e) {
    db.execute("ROLLBACK");
    jsonErr(ctx, 500, String(e));
  }
});

// POST /api/reference — import reference code tables (requires API key in production)
router.post("/api/reference", async (ctx) => {
  if (!requireApiKey(ctx)) return;
  const body = await ctx.request.body.json();
  const { type, codes, year } = body;

  if (!type || !codes || typeof codes !== "object") {
    return jsonErr(ctx, 400, "Expected { type: 'berth'|'port'|'ship', codes: {CODE: desc} }");
  }

  const tableMap: Record<string, string> = {
    berth: "ref_berth_codes",
    port:  "ref_port_codes",
    ship:  "ref_ship_codes",
  };
  const table = tableMap[type];
  if (!table) return jsonErr(ctx, 400, `Unknown type: ${type}`);

  let count = 0;
  db.execute("BEGIN TRANSACTION");
  try {
    for (const [code, description] of Object.entries(codes)) {
      db.query(
        `INSERT INTO ${table} (code, description, year) VALUES (?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET description=excluded.description, year=excluded.year`,
        [code, String(description), year ?? null]
      );
      count++;
    }
    db.execute("COMMIT");
    jsonOk(ctx, { success: true, type, count });
  } catch (e) {
    db.execute("ROLLBACK");
    jsonErr(ctx, 500, String(e));
  }
});

// GET /api/reference/:type  — retrieve reference codes
router.get("/api/reference/:type", (ctx) => {
  const tableMap: Record<string, string> = {
    berth: "ref_berth_codes",
    port:  "ref_port_codes",
    ship:  "ref_ship_codes",
  };
  const table = tableMap[ctx.params.type ?? ""];
  if (!table) return jsonErr(ctx, 400, "type must be berth, port, or ship");

  const rows = db.query<[string, string]>(`SELECT code, description FROM ${table} ORDER BY code`)
    .map(([code, description]) => ({ code, description }));
  jsonOk(ctx, { codes: rows });
});

// DELETE /api/data — clear all records for a given year (requires API key in production)
router.delete("/api/data", async (ctx) => {
  if (!requireApiKey(ctx)) return;
  const { year } = await ctx.request.body.json();
  if (!year) return jsonErr(ctx, 400, "year required");
  db.query("DELETE FROM port_calls WHERE year = ?", [year]);
  jsonOk(ctx, { success: true, deleted: db.changes });
});

// ── Start server ─────────────────────────────────────────────────────────────
const app = new Application();

// CORS: allow all in dev, restrict to ALLOWED_ORIGIN in production
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
if (allowedOrigin !== "*") {
  console.log(`🔒 CORS restricted to: ${allowedOrigin}`);
}
app.use(oakCors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));
app.use(router.routes());
app.use(router.allowedMethods());

const port = parseInt(Deno.env.get("PORT") ?? "8000");
console.log(`⚓ Harborwatch API  →  http://localhost:${port}`);
await app.listen({ port });
