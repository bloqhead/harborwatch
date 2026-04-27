<template>
  <div>
    <!-- Loading -->
    <template v-if="api.loading.value && !ship">
      <div class="loading-bar" style="margin-bottom:24px;" />
      <div class="ship-detail-grid">
        <div class="card" style="padding:0; overflow:hidden;">
          <div v-for="i in 12" :key="i" class="skeleton-row" :style="{ opacity: 1 - i * 0.07 }" />
        </div>
        <div class="card skeleton-row" style="height:300px;" />
      </div>
    </template>

    <!-- Not found -->
    <div v-else-if="notFound" class="empty-state">
      <div class="icon">🚢</div>
      <div>Ship not found: <strong>{{ shipName }}</strong></div>
      <router-link to="/" style="color:var(--gold); margin-top:8px; display:inline-block;">← Back to Schedule</router-link>
    </div>

    <template v-else-if="ship">
      <!-- Header -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:16px; flex-wrap:wrap;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <router-link to="/" style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); text-decoration:none; letter-spacing:0.06em;">
              ← SCHEDULE
            </router-link>
          </div>
          <h1 style="margin-bottom:4px; font-size:1.7rem;">{{ ship.name }}</h1>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span v-if="ship.metadata?.cruise_line"
              style="font-family:var(--font-mono); font-size:0.78rem; color:var(--cyan-accent);">
              {{ ship.metadata.cruise_line }}
            </span>
            <span v-if="ship.metadata?.flag"
              style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">
              🏴 {{ ship.metadata.flag }}
            </span>
            <span v-if="ship.metadata?.year_built"
              style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">
              Built {{ ship.metadata.year_built }}
            </span>
          </div>
        </div>

        <!-- Year tabs + Share -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost" style="font-size:0.72rem;" @click="copyUrl">
            {{ copied ? '✅ Copied!' : '🔗 Share' }}
          </button>
          <div class="year-tabs">
            <button v-for="y in ship.yearsActive" :key="y"
              class="year-tab" :class="{ active: selectedYear === String(y) }"
              @click="setYear(String(y))">{{ y }}</button>
            <button class="year-tab" :class="{ active: selectedYear === '' }"
              @click="setYear('')">All</button>
          </div>
        </div>
      </div>

      <div class="ship-detail-grid">

        <!-- Left: Timeline + Voyage -->
        <div style="min-width:0;">
          <!-- Stat cards -->
          <div class="stat-grid" style="margin-bottom:20px; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr));">
            <div class="stat-card">
              <div class="stat-value">{{ ship.totalCalls.toLocaleString() }}</div>
              <div class="stat-label">Port Calls</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ ship.uniquePorts }}</div>
              <div class="stat-label">Ports Visited</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ seasonLength }}</div>
              <div class="stat-label">Season Days</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{{ avgCallsPerMonth }}</div>
              <div class="stat-label">Avg Calls/Mo</div>
            </div>
          </div>

          <!-- Monthly activity -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header">
              <h3>Monthly Activity</h3>
              <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">Port calls per month</span>
            </div>
            <div class="month-bars" style="height:120px;">
              <div v-for="m in fullMonthData" :key="m.month" class="month-col">
                <div class="month-val" style="font-size:0.6rem;">{{ m.calls || '' }}</div>
                <div class="month-bar"
                  :style="{ height: m.calls ? (m.calls / maxMonthCalls * 95)+'px' : '2px',
                            opacity: m.calls ? 1 : 0.15 }" />
                <div class="month-lbl">{{ m.label }}</div>
              </div>
            </div>
          </div>

          <!-- Voyage timeline -->
          <div class="card">
            <div class="card-header">
              <h3>Voyage Timeline</h3>
              <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">
                {{ filteredCalls.length }} calls
              </span>
            </div>

            <!-- Month filter pills -->
            <div v-if="timelineMonths.length > 1" class="month-nav" style="margin-bottom:16px;">
              <button class="month-btn" :class="{ active: timelineMonth === '' }" @click="timelineMonth = ''">All</button>
              <button v-for="m in timelineMonths" :key="m.value"
                class="month-btn" :class="{ active: timelineMonth === m.value }"
                @click="timelineMonth = m.value">{{ m.label }}</button>
            </div>

            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Port</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                    <th>In Port</th>
                    <th>Berth</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="call in paginatedCalls" :key="call.date_iso + call.port_code">
                    <td style="white-space:nowrap; font-family:var(--font-mono);">{{ formatDate(call.date_iso) }}</td>
                    <td style="color:var(--text-muted);">{{ call.day_of_week.slice(0,3) }}</td>
                    <td>
                      <router-link :to="`/?port=${call.port_code}&year=${selectedYear}`"
                        style="text-decoration:none;" @click="events.filterPort(call.port_code, selectedYear)">
                        <span class="badge badge-port">{{ call.port_code }}</span>
                      </router-link>
                    </td>
                    <td><span style="color:var(--green-ok); font-family:var(--font-mono);">{{ call.arrival_time ?? '—' }}</span></td>
                    <td><span style="color:var(--red-alert); font-family:var(--font-mono);">{{ call.departure_time ?? '—' }}</span></td>
                    <td style="color:var(--text-muted); font-size:0.78rem; font-family:var(--font-mono);">{{ hoursInPort(call.arrival_time, call.departure_time) }}</td>
                    <td>
                      <span v-if="call.berth_code" class="badge badge-berth" style="cursor:help;" :title="call.berth_code">{{ call.berth_code }}</span>
                      <span v-else style="color:var(--text-muted);">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Timeline pagination -->
            <div v-if="timelinePages > 1" class="pagination">
              <span>{{ timelineRangeStart }}–{{ timelineRangeEnd }} of {{ filteredCalls.length }}</span>
              <div class="page-controls">
                <button class="page-btn" :disabled="timelinePage <= 1" @click="timelinePage--">‹</button>
                <button v-for="p in visibleTimelinePages" :key="p"
                  class="page-btn" :class="{ current: p === timelinePage }"
                  @click="timelinePage = p">{{ p }}</button>
                <button class="page-btn" :disabled="timelinePage >= timelinePages" @click="timelinePage++">›</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Metadata + Top ports + External links -->
        <div style="display:flex; flex-direction:column; gap:16px; min-width:0;">

          <!-- Ship photo or placeholder -->
          <div class="card" style="padding:0; overflow:hidden;">
            <template v-if="ship.metadata?.image_url">
              <img
                :src="imageUrl"
                :alt="ship.name"
                style="width:100%; display:block; max-height:220px; object-fit:cover; object-position:center;"
              />
              <div v-if="ship.metadata.image_caption"
                style="padding:8px 12px; font-family:var(--font-mono); font-size:0.62rem; color:var(--text-muted); line-height:1.4; border-top:1px solid var(--navy-border);">
                📷 via <a
                  href="https://commons.wikimedia.org"
                  target="_blank" rel="noopener"
                  style="color:var(--text-muted); text-decoration:underline;">Wikimedia Commons</a>
              </div>
            </template>
            <template v-else>
              <div style="height:160px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; background:var(--surface-2);">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <path d="M6 36L16 22l8 10 6-7 12 14H6z" stroke="var(--gold)" stroke-width="1.5" stroke-linejoin="round"/>
                  <circle cx="34" cy="16" r="4" stroke="var(--gold)" stroke-width="1.5"/>
                  <rect x="3" y="8" width="42" height="32" rx="3" stroke="var(--gold)" stroke-width="1.5"/>
                </svg>
                <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); letter-spacing:0.08em; text-transform:uppercase;">No photo yet</span>
              </div>
            </template>
          </div>

          <!-- Ship specs -->
          <div v-if="ship.metadata" class="card">
            <div class="card-header" style="margin-bottom:12px;">
              <h3>Ship Details</h3>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div v-for="spec in shipSpecs" :key="spec.label"
              class="spec-row"
              style="display:flex; justify-content:space-between; align-items:baseline; padding:5px 0; border-bottom:1px solid rgba(30,64,112,0.3); gap:8px;">
              <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; flex-shrink:0;">{{ spec.label }}</span>
              <span class="spec-value" style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-primary); text-align:right; word-break:break-word;">{{ spec.value }}</span>
            </div>
            </div>
          </div>

          <!-- No metadata yet — invite contribution -->
          <div v-else class="card" style="border-style:dashed; opacity:0.7;">
            <div style="text-align:center; padding:8px 0;">
              <div style="font-size:1.5rem; margin-bottom:8px;">🔍</div>
              <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); line-height:1.6;">
                No metadata yet for this ship.<br/>
                Check MarineTraffic for specs.
              </div>
            </div>
          </div>

          <!-- Season summary -->
          <div class="card">
            <div class="card-header" style="margin-bottom:12px;">
              <h3>Season Summary</h3>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div v-if="ship.firstCall" style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(30,64,112,0.3);">
                <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">First Call</span>
                <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-primary); text-align:right;">
                  {{ formatDate(ship.firstCall.date) }}<br/>
                  <span class="badge badge-port" style="font-size:0.62rem;">{{ ship.firstCall.port }}</span>
                </span>
              </div>
              <div v-if="ship.lastCall" style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(30,64,112,0.3);">
                <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">Last Call</span>
                <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-primary); text-align:right;">
                  {{ formatDate(ship.lastCall.date) }}<br/>
                  <span class="badge badge-port" style="font-size:0.62rem;">{{ ship.lastCall.port }}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Top ports -->
          <div class="card">
            <div class="card-header" style="margin-bottom:12px;">
              <h3>Top Ports</h3>
            </div>
            <div class="bar-chart">
              <div v-for="port in ship.topPorts" :key="port.code" class="bar-row">
                <div class="bar-label" style="width:110px;" :title="port.name">
                  <router-link :to="`/?port=${port.code}&year=${selectedYear}`"
                    style="text-decoration:none;"
                    @click="events.filterPort(port.code, selectedYear)">
                    <span class="badge badge-port" style="font-size:0.62rem; padding:1px 5px;">{{ port.code }}</span>
                  </router-link>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: (port.calls / ship!.topPorts[0].calls * 100)+'%' }" />
                </div>
                <div class="bar-value">{{ port.calls }}</div>
              </div>
            </div>
          </div>

          <!-- External links -->
          <div class="card">
            <div class="card-header" style="margin-bottom:12px;">
              <h3>External Links</h3>
              <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted);">Live tracking &amp; info</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <!-- MarineTraffic -->
              <a :href="marineTrafficUrl" target="_blank" rel="noopener"
                class="external-link-btn"
                @click="events.shipExternalLink(ship.name, 'marinetraffic')">
                <span class="ext-icon">📡</span>
                <div>
                  <div style="font-weight:500;">MarineTraffic</div>
                  <div style="font-size:0.68rem; opacity:0.6;">
                    {{ ship.metadata?.mt_url ? 'Live AIS — direct vessel page' : 'Live AIS — search results' }}
                  </div>
                </div>
                <span style="margin-left:auto; opacity:0.4;">↗</span>
              </a>

              <!-- VesselFinder -->
              <a :href="vesselFinderUrl" target="_blank" rel="noopener"
                class="external-link-btn"
                @click="events.shipExternalLink(ship.name, 'vesselfinder')">
                <span class="ext-icon">🛰️</span>
                <div>
                  <div style="font-weight:500;">VesselFinder</div>
                  <div style="font-size:0.68rem; opacity:0.6;">
                    {{ imo ? 'Real-time tracking — direct vessel page' : 'Real-time tracking — search results' }}
                  </div>
                </div>
                <span style="margin-left:auto; opacity:0.4;">↗</span>
              </a>

              <!-- ShipMapper -->
              <a :href="shipMapperUrl" target="_blank" rel="noopener"
                class="external-link-btn"
                @click="events.shipExternalLink(ship.name, 'shipmapper')">
                <span class="ext-icon">🗺️</span>
                <div>
                  <div style="font-weight:500;">ShipMapper</div>
                  <div style="font-size:0.68rem; opacity:0.6;">Map view &amp; route history</div>
                </div>
                <span style="margin-left:auto; opacity:0.4;">↗</span>
              </a>
            </div>

            <p style="font-family:var(--font-mono); font-size:0.62rem; color:var(--text-muted); margin-top:12px; line-height:1.5; opacity:0.7;">
              External links show current position — the ship may not be in Alaskan waters year-round.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApi, type ShipDetail, type ShipPortCall } from "../stores/api";
import { useAnalytics } from "../composables/useAnalytics";

const api = useApi();
const route = useRoute();
const router = useRouter();
const { events } = useAnalytics();

const ship = ref<ShipDetail | null>(null);
const notFound = ref(false);
const copied = ref(false);
const selectedYear = ref("");
const timelineMonth = ref<number | "">("");
const timelinePage = ref(1);
const TIMELINE_PAGE_SIZE = 50;

const shipName = computed(() => decodeURIComponent(String(route.params.name ?? "")).toUpperCase());

// ── URL sync ──────────────────────────────────────────────────────────────────
function pushUrl() {
  const q: Record<string, string> = {};
  if (selectedYear.value) q.year = selectedYear.value;
  router.replace({ query: q });
}

function setYear(y: string) {
  selectedYear.value = y;
  timelinePage.value = 1;
  timelineMonth.value = "";
  pushUrl();
  events.shipYearSwitch(shipName.value, y);
  loadShip();
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    events.shipShareUrl(shipName.value);
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    prompt("Copy this URL:", window.location.href);
  }
}

// ── Data ──────────────────────────────────────────────────────────────────────
async function loadShip() {
  notFound.value = false;
  const data = await api.getShipDetail(shipName.value, selectedYear.value || undefined);
  if (!data) { notFound.value = true; return; }
  ship.value = data;
}

// ── Timeline filtering & pagination ──────────────────────────────────────────
const filteredCalls = computed<ShipPortCall[]>(() => {
  if (!ship.value) return [];
  if (timelineMonth.value === "") return ship.value.portCalls;
  return ship.value.portCalls.filter(c => parseInt(c.date_iso.split("-")[1]) === timelineMonth.value);
});

const timelinePages = computed(() => Math.ceil(filteredCalls.value.length / TIMELINE_PAGE_SIZE));
const timelineRangeStart = computed(() => (timelinePage.value - 1) * TIMELINE_PAGE_SIZE + 1);
const timelineRangeEnd = computed(() => Math.min(timelinePage.value * TIMELINE_PAGE_SIZE, filteredCalls.value.length));
const paginatedCalls = computed(() =>
  filteredCalls.value.slice((timelinePage.value - 1) * TIMELINE_PAGE_SIZE, timelinePage.value * TIMELINE_PAGE_SIZE)
);
const visibleTimelinePages = computed(() => {
  const cur = timelinePage.value, total = timelinePages.value;
  const pages: number[] = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
  return pages;
});

watch(timelineMonth, () => { timelinePage.value = 1; });

const timelineMonths = computed(() => {
  if (!ship.value) return [];
  const months = new Set<number>();
  ship.value.portCalls.forEach(c => months.add(parseInt(c.date_iso.split("-")[1])));
  const N = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from(months).sort().map(m => ({ value: m, label: N[m] }));
});

// ── Monthly chart ─────────────────────────────────────────────────────────────
const MONTH_LABELS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fullMonthData = computed(() => {
  if (!ship.value) return [];
  const map = new Map<number, number>();
  ship.value.byMonth.forEach(m => map.set(m.month, m.calls));
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, label: MONTH_LABELS[i + 1], calls: map.get(i + 1) ?? 0,
  }));
});
const maxMonthCalls = computed(() => Math.max(...fullMonthData.value.map(m => m.calls), 1));

// ── Stats ─────────────────────────────────────────────────────────────────────
const seasonLength = computed(() => {
  if (!ship.value?.firstCall || !ship.value?.lastCall) return "—";
  const a = new Date(ship.value.firstCall.date);
  const b = new Date(ship.value.lastCall.date);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + "d";
});

const avgCallsPerMonth = computed(() => {
  if (!ship.value) return "—";
  const active = ship.value.byMonth.filter(m => m.calls > 0).length;
  return active > 0 ? (ship.value.totalCalls / active).toFixed(1) : "—";
});

// ── Ship specs for metadata panel ─────────────────────────────────────────────
const shipSpecs = computed(() => {
  const m = ship.value?.metadata;
  if (!m) return [];
  const fmt = (v: number | null, suffix = "") => v != null ? `${v.toLocaleString()}${suffix}` : null;
  return [
    { label: "IMO",        value: m.imo },
    { label: "Cruise Line", value: m.cruise_line },
    { label: "Flag",       value: m.flag },
    { label: "Built",      value: m.year_built ? String(m.year_built) : null },
    { label: "Tonnage",    value: fmt(m.gross_tonnage, " GT") },
    { label: "Passengers", value: fmt(m.passengers) },
    { label: "Crew",       value: fmt(m.crew) },
    { label: "Length",     value: fmt(m.length_m, " m") },
    { label: "Beam",       value: fmt(m.beam_m, " m") },
    { label: "Homeport",   value: m.homeport },
  ].filter(s => s.value != null) as { label: string; value: string }[];
});

// ── Image URL ─────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const imageUrl = computed(() => {
  const url = ship.value?.metadata?.image_url;
  if (!url) return null;
  // Local path like /api/images/NOORDAM.jpg — prepend API base
  if (url.startsWith("/api/")) return `${API_BASE}${url}`;
  // Already a full URL (old Wikimedia URLs) — use as-is
  return url;
});

// ── External link URLs ────────────────────────────────────────────────────────
const encodedName = computed(() => encodeURIComponent(ship.value?.name ?? ""));
const imo = computed(() => ship.value?.metadata?.imo ?? null);

// MarineTraffic: use stored mt_url if available (has shipid), otherwise search
const marineTrafficUrl = computed(() =>
  ship.value?.metadata?.mt_url
    ?? `https://www.marinetraffic.com/en/ais/index/search/all/keyword:${encodedName.value}`
);

// VesselFinder: use IMO-based URL if available (direct vessel page), otherwise name search
const vesselFinderUrl = computed(() =>
  imo.value
    ? `https://www.vesselfinder.com/vessels/details/${imo.value}`
    : `https://www.vesselfinder.com/?name=${encodedName.value}`
);

// ShipMapper: name-slug based, works reasonably well for major cruise ships
const shipMapperUrl = computed(() => {
  const slug = (ship.value?.name ?? "").toLowerCase().replace(/\s+/g, "-");
  return `https://shipmapper.com/vessels/${slug}`;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function hoursInPort(arrival: string | null, departure: string | null): string {
  if (!arrival || !departure) return "—";
  const [ah, am] = arrival.split(":").map(Number);
  const [dh, dm] = departure.split(":").map(Number);
  let mins = (dh * 60 + dm) - (ah * 60 + am);
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (route.query.year) selectedYear.value = String(route.query.year);
  await loadShip();
  if (ship.value) {
    // Default to most recent year if none specified
    if (!selectedYear.value && ship.value.yearsActive.length) {
      selectedYear.value = String(Math.max(...ship.value.yearsActive));
      pushUrl();
      await loadShip();
    }
    events.shipView(ship.value.name);
  }
});
</script>

<style scoped>
.skeleton-row {
  height: 44px;
  background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-bottom: 1px solid var(--navy-border);
}

/* Two-column layout: timeline left, sidebar right */
.ship-detail-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
  /* Prevent grid from overflowing its container */
  min-width: 0;
  width: 100%;
}

/* Collapse to single column on mobile */
@media (max-width: 768px) {
  .ship-detail-grid {
    grid-template-columns: 1fr;
  }

  /* Sidebar moves above timeline on mobile */
  .ship-detail-grid > div:last-child {
    order: -1;
  }

  /* Ship name can be long — allow wrapping */
  h1 {
    font-size: 1.3rem !important;
    word-break: break-word;
  }

  /* Spec rows: let values wrap instead of overflowing */
  .spec-row {
    flex-wrap: wrap;
    gap: 2px;
  }

  .spec-value {
    text-align: left !important;
  }

  /* External link buttons — tighter on mobile */
  .external-link-btn {
    padding: 8px 10px;
    font-size: 0.72rem;
  }
}

.external-link-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--navy-border);
  background: var(--surface-2);
  color: var(--text-primary);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  transition: border-color 0.15s, background 0.15s;
  /* Prevent button from overflowing */
  min-width: 0;
  overflow: hidden;
}
.external-link-btn:hover {
  border-color: var(--gold-dim);
  background: var(--surface-3);
  color: var(--gold);
}
.ext-icon { font-size: 1.1rem; flex-shrink: 0; }
</style>
