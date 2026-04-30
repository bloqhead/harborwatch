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
    created_at     TEXT DEFAULT (datetime('now')),
    last_modified  TEXT,
    previous_values TEXT   -- JSON: {arrival_time, departure_time, berth_code} before last change
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

  -- Extended ship metadata (enriched from external sources)
  CREATE TABLE IF NOT EXISTS ship_metadata (
    name          TEXT PRIMARY KEY,
    imo           TEXT,
    cruise_line   TEXT,
    gross_tonnage INTEGER,
    passengers    INTEGER,
    crew          INTEGER,
    year_built    INTEGER,
    length_m      REAL,
    beam_m        REAL,
    flag          TEXT,
    homeport      TEXT,
    notes         TEXT,
    mt_url        TEXT,
    image_url     TEXT,   -- Wikipedia/Wikimedia Commons image
    image_caption TEXT,   -- Attribution/caption for the image
    updated_at    TEXT DEFAULT (datetime('now'))
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


// ── Migrations — safely add new columns to existing tables ───────────────────
for (const sql of [
  `ALTER TABLE ship_metadata ADD COLUMN image_url TEXT`,
  `ALTER TABLE ship_metadata ADD COLUMN image_caption TEXT`,
  `ALTER TABLE port_calls ADD COLUMN last_modified TEXT`,
  `ALTER TABLE port_calls ADD COLUMN previous_values TEXT`,
]) {
  try { db.execute(sql); } catch { /* column already exists, ignore */ }
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

// GET /api/ships — all ship names with optional metadata
router.get("/api/ships", (ctx) => {
  const withMeta = ctx.request.url.searchParams.get("meta") === "1";
  if (withMeta) {
    const ships = db.query<[string, number | null, string | null, string | null, number | null]>(
      `SELECT s.name, s.first_seen_year, m.cruise_line, m.imo, m.gross_tonnage
       FROM ships s LEFT JOIN ship_metadata m ON s.name = m.name
       ORDER BY s.name`
    ).map(([name, first_seen_year, cruise_line, imo, gross_tonnage]) => ({
      name, first_seen_year, cruise_line, imo, gross_tonnage
    }));
    return jsonOk(ctx, { ships });
  }
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

  const rows = db.query<[number,number,string,string,string,string,string,string|null,string|null,string|null,string,string|null,string|null]>(
    `SELECT id, year, port_code, port_name, ship_name, date_str, date_iso,
            arrival_time, departure_time, berth_code, day_of_week,
            last_modified, previous_values
     FROM port_calls ${where}
     ORDER BY date_iso ASC, arrival_time ASC
     LIMIT ? OFFSET ?`,
    [...vals, limit, offset]
  ).map(([id,year,port_code,port_name,ship_name,date_str,date_iso,
          arrival_time,departure_time,berth_code,day_of_week,
          last_modified,previous_values]) => ({
    id, year, port_code, port_name, ship_name, date_str, date_iso,
    arrival_time, departure_time, berth_code, day_of_week,
    last_modified: last_modified ?? null,
    previous_values: previous_values ? JSON.parse(previous_values) : null,
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

// GET /api/ship/:name — full detail for a single ship
router.get("/api/ship/:name", (ctx) => {
  const name = decodeURIComponent(ctx.params.name ?? "").toUpperCase();
  const year = ctx.request.url.searchParams.get("year");
  if (!name) return jsonErr(ctx, 400, "name required");

  const yearCond = year ? "AND year = ?" : "";
  const vals: (string | number)[] = year ? [name, parseInt(year)] : [name];

  const totalCalls = db.query<[number]>(
    `SELECT COUNT(*) FROM port_calls WHERE ship_name = ? ${yearCond}`, vals
  )[0][0];

  if (totalCalls === 0) return jsonErr(ctx, 404, `No data for ship: ${name}`);

  const yearsActive = db.query<[number]>(
    `SELECT DISTINCT year FROM port_calls WHERE ship_name = ? ORDER BY year`, [name]
  ).map(([y]) => y);

  const portCalls = db.query<[string, string, string | null, string | null, string | null, string]>(
    `SELECT date_iso, port_code, arrival_time, departure_time, berth_code, day_of_week
     FROM port_calls WHERE ship_name = ? ${yearCond}
     ORDER BY date_iso ASC, arrival_time ASC`,
    vals
  ).map(([date_iso, port_code, arrival_time, departure_time, berth_code, day_of_week]) => ({
    date_iso, port_code, arrival_time, departure_time, berth_code, day_of_week
  }));

  // Port visit counts
  const topPorts = db.query<[string, string, number]>(
    `SELECT port_code, port_name, COUNT(*) as calls
     FROM port_calls WHERE ship_name = ? ${yearCond}
     GROUP BY port_code ORDER BY calls DESC LIMIT 10`,
    vals
  ).map(([code, name, calls]) => ({ code, name, calls }));

  // Monthly distribution
  const byMonth = db.query<[string, number]>(
    `SELECT strftime('%m', date_iso) as month, COUNT(*) as calls
     FROM port_calls WHERE ship_name = ? ${yearCond}
     GROUP BY month ORDER BY month`,
    vals
  ).map(([month, calls]) => ({ month: parseInt(month), calls }));

  // Unique ports visited
  const uniquePorts = db.query<[number]>(
    `SELECT COUNT(DISTINCT port_code) FROM port_calls WHERE ship_name = ? ${yearCond}`, vals
  )[0][0];

  // First and last call this season
  const firstCall = db.query<[string, string]>(
    `SELECT date_iso, port_code FROM port_calls WHERE ship_name = ? ${yearCond} ORDER BY date_iso ASC LIMIT 1`, vals
  )[0];
  const lastCall = db.query<[string, string]>(
    `SELECT date_iso, port_code FROM port_calls WHERE ship_name = ? ${yearCond} ORDER BY date_iso DESC LIMIT 1`, vals
  )[0];

  // Metadata if available
  const meta = db.query<[string|null,string|null,string|null,number|null,number|null,number|null,number|null,number|null,number|null,string|null,string|null,string|null,string|null,string|null]>(
    `SELECT imo, cruise_line, flag, gross_tonnage, passengers, crew, year_built,
            length_m, beam_m, homeport, notes, mt_url, image_url, image_caption
     FROM ship_metadata WHERE name = ?`, [name]
  ).map(([imo,cruise_line,flag,gross_tonnage,passengers,crew,year_built,length_m,beam_m,homeport,notes,mt_url,image_url,image_caption]) => ({
    imo, cruise_line, flag, gross_tonnage, passengers, crew, year_built,
    length_m, beam_m, homeport, notes, mt_url, image_url, image_caption
  }))[0] ?? null;

  jsonOk(ctx, {
    name,
    totalCalls,
    uniquePorts,
    yearsActive,
    firstCall: firstCall ? { date: firstCall[0], port: firstCall[1] } : null,
    lastCall:  lastCall  ? { date: lastCall[0],  port: lastCall[1]  } : null,
    portCalls,
    topPorts,
    byMonth,
    metadata: meta,
  });
});

// POST /api/ship-image — upload a ship image file, store on disk (requires API key)
router.post("/api/ship-image", async (ctx) => {
  if (!requireApiKey(ctx)) return;

  const body = await ctx.request.body.json();
  const { name, imageData, mimeType, caption } = body;

  if (!name || !imageData) return jsonErr(ctx, 400, "name and imageData required");

  // Ensure images directory exists
  const imagesDir = DB_PATH.replace("cruise_data.db", "images");
  try { await Deno.mkdir(imagesDir, { recursive: true }); } catch { /* already exists */ }

  // Sanitise filename: uppercase ship name, spaces to underscores
  const ext = mimeType?.includes("png") ? "png" : "jpg";
  const filename = name.toUpperCase().replace(/\s+/g, "_") + "." + ext;
  const filepath = `${imagesDir}/${filename}`;

  // Decode base64 and write to disk
  try {
    const bytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    await Deno.writeFile(filepath, bytes);
  } catch (e) {
    return jsonErr(ctx, 500, `Failed to write image: ${String(e)}`);
  }

  // Store local URL in ship_metadata (overwriting any previous image_url)
  const localUrl = `/api/images/${filename}`;
  db.query(
    `INSERT INTO ship_metadata (name, image_url, image_caption, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       image_url     = excluded.image_url,
       image_caption = COALESCE(excluded.image_caption, image_caption),
       updated_at    = datetime('now')`,
    [name.toUpperCase(), localUrl, caption ?? null]
  );

  jsonOk(ctx, { success: true, filename, url: localUrl });
});

// GET /api/images/:filename — serve locally stored ship images
router.get("/api/images/:filename", async (ctx) => {
  const filename = ctx.params.filename ?? "";

  // Basic path traversal protection
  if (filename.includes("..") || filename.includes("/")) {
    return jsonErr(ctx, 400, "Invalid filename");
  }

  const imagesDir = DB_PATH.replace("cruise_data.db", "images");
  const filepath = `${imagesDir}/${filename}`;

  try {
    const file = await Deno.readFile(filepath);
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    ctx.response.headers.set("Content-Type", contentType);
    ctx.response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    ctx.response.body = file;
  } catch {
    jsonErr(ctx, 404, "Image not found");
  }
});

// POST /api/ship-metadata — upsert metadata for one or more ships (requires API key)
router.post("/api/ship-metadata", async (ctx) => {
  if (!requireApiKey(ctx)) return;
  const body = await ctx.request.body.json();
  const { ships } = body;
  if (!Array.isArray(ships)) return jsonErr(ctx, 400, "Expected { ships: [...] }");

  let upserted = 0;
  db.execute("BEGIN TRANSACTION");
  try {
    for (const s of ships) {
      db.query(
        `INSERT INTO ship_metadata (name, imo, cruise_line, gross_tonnage, passengers, crew,
          year_built, length_m, beam_m, flag, homeport, notes, mt_url, image_url, image_caption, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
         ON CONFLICT(name) DO UPDATE SET
           imo            = COALESCE(excluded.imo,            imo),
           cruise_line    = COALESCE(excluded.cruise_line,    cruise_line),
           gross_tonnage  = COALESCE(excluded.gross_tonnage,  gross_tonnage),
           passengers     = COALESCE(excluded.passengers,     passengers),
           crew           = COALESCE(excluded.crew,           crew),
           year_built     = COALESCE(excluded.year_built,     year_built),
           length_m       = COALESCE(excluded.length_m,       length_m),
           beam_m         = COALESCE(excluded.beam_m,         beam_m),
           flag           = COALESCE(excluded.flag,           flag),
           homeport       = COALESCE(excluded.homeport,       homeport),
           notes          = COALESCE(excluded.notes,          notes),
           mt_url         = COALESCE(excluded.mt_url,         mt_url),
           image_url      = COALESCE(excluded.image_url,      image_url),
           image_caption  = COALESCE(excluded.image_caption,  image_caption),
           updated_at     = datetime('now')`,
        [s.name, s.imo??null, s.cruise_line??null, s.gross_tonnage??null,
         s.passengers??null, s.crew??null, s.year_built??null,
         s.length_m??null, s.beam_m??null, s.flag??null,
         s.homeport??null, s.notes??null, s.mt_url??null,
         s.image_url??null, s.image_caption??null]
      );
      upserted++;
    }
    db.execute("COMMIT");
    jsonOk(ctx, { success: true, upserted });
  } catch (e) {
    db.execute("ROLLBACK");
    jsonErr(ctx, 500, String(e));
  }
});

// GET /api/changes — recently modified or inserted port calls
// ?days=7 (default) — how far back to look
// ?year=2026 — optional year filter
router.get("/api/changes", (ctx) => {
  const p = ctx.request.url.searchParams;
  const days = parseInt(p.get("days") ?? "7");
  const year = p.get("year");

  const yearCond = year ? "AND year = ?" : "";
  const vals: (string | number)[] = year ? [days, parseInt(year)] : [days];

  const rows = db.query<[number,number,string,string,string,string,string,string|null,string|null,string|null,string,string,string|null]>(
    `SELECT id, year, port_code, port_name, ship_name, date_str, date_iso,
            arrival_time, departure_time, berth_code, day_of_week,
            last_modified, previous_values
     FROM port_calls
     WHERE last_modified >= datetime('now', '-' || ? || ' days') ${yearCond}
     ORDER BY last_modified DESC`,
    vals
  ).map(([id,year,port_code,port_name,ship_name,date_str,date_iso,
          arrival_time,departure_time,berth_code,day_of_week,
          last_modified,previous_values]) => ({
    id, year, port_code, port_name, ship_name, date_str, date_iso,
    arrival_time, departure_time, berth_code, day_of_week,
    last_modified,
    previous_values: previous_values ? JSON.parse(previous_values) : null,
  }));

  jsonOk(ctx, { changes: rows, days, count: rows.length });
});

// GET /api/port/:code — detail for a single port
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

  let inserted = 0, updated = 0, unchanged = 0;
  db.execute("BEGIN TRANSACTION");
  try {
    for (const r of records) {
      db.query("INSERT OR IGNORE INTO ports (code, name) VALUES (?, ?)", [r.port_code, r.port_name]);
      db.query("INSERT OR IGNORE INTO ships (name, first_seen_year) VALUES (?, ?)", [r.ship_name, r.year]);

      // Identity: a ship can only have one call at a port on a given day
      // If the record exists, update mutable fields (times, berth) in case CLA revised the PDF
      const existing = db.query<[number, string | null, string | null, string | null]>(
        `SELECT id, arrival_time, departure_time, berth_code
         FROM port_calls
         WHERE year=? AND port_code=? AND ship_name=? AND date_iso=?`,
        [r.year, r.port_code, r.ship_name, r.date_iso]
      )[0];

      if (!existing) {
        db.query(
          `INSERT INTO port_calls (year,port_code,port_name,ship_name,date_str,date_iso,
                                   arrival_time,departure_time,berth_code,day_of_week)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.year,r.port_code,r.port_name,r.ship_name,r.date_str,r.date_iso,
           r.arrival_time,r.departure_time,r.berth_code,r.day_of_week]
        );
        inserted++;
      } else {
        const [id, oldArrival, oldDeparture, oldBerth] = existing;
        const changed =
          (r.arrival_time   ?? null) !== oldArrival   ||
          (r.departure_time ?? null) !== oldDeparture ||
          (r.berth_code     ?? null) !== oldBerth;

        if (changed) {
          const prev = JSON.stringify({
            arrival_time:   oldArrival,
            departure_time: oldDeparture,
            berth_code:     oldBerth,
          });
          db.query(
            `UPDATE port_calls
             SET arrival_time=?, departure_time=?, berth_code=?, date_str=?,
                 last_modified=datetime('now'), previous_values=?
             WHERE id=?`,
            [r.arrival_time ?? null, r.departure_time ?? null,
             r.berth_code ?? null, r.date_str, prev, id]
          );
          updated++;
        } else {
          unchanged++;
        }
      }
    }
    db.execute("COMMIT");
    jsonOk(ctx, { success: true, inserted, updated, unchanged });
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
