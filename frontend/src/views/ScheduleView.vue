<template>
  <div>
    <!-- Header row -->
    <div class="flex-align-end flex-justify-between mb-20 gap-16 flex-wrap">
      <div>
        <h1 class="mb-4">Port Schedule</h1>
        <p class="text-muted font-mono text-base letter-spacing-sm">
          ALASKA CRUISE LINE AGENCIES — SHIP ARRIVALS &amp; DEPARTURES
        </p>
      </div>
      <div class="flex-align-center gap-12 flex-wrap">
        <!-- Quick date buttons -->
        <div class="flex gap-4">
          <button class="btn btn-ghost text-sm" @click="jumpToToday">Today</button>
          <button class="btn btn-ghost text-sm" @click="jumpToWeek">This Week</button>
        </div>

        <!-- Desktop: Year tabs -->
        <div class="year-tabs desktop-only">
          <button v-for="y in years" :key="y"
            class="year-tab" :class="{ active: filters.year === String(y) }"
            @click="setYear(String(y))">{{ y }}</button>
          <button class="year-tab" :class="{ active: filters.year === '' }" @click="setYear('')">All</button>
        </div>

        <!-- Mobile: Year dropdown -->
        <div class="year-select-mobile mobile-only">
          <label class="mono-muted-label mr-6">Year:</label>
          <select v-model="filters.year" @change="resetAndSearch()" class="select-style">
            <option value="">All Years</option>
            <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Filters card -->
    <div class="card filters-card mb-16">
      <button class="mobile-filter-toggle" @click="filtersExpanded = !filtersExpanded">
        <span>{{ filtersExpanded ? '▼' : '▶' }} Filters</span>
        <span v-if="activeChips.length" class="filter-count">{{ activeChips.length }}</span>
      </button>
      <div class="filters-bar" :class="{ expanded: filtersExpanded }">
        <div class="filter-group">
          <label>Port</label>
          <select v-model="filters.port" @change="resetAndSearch">
            <option value="">All Ports</option>
            <option v-for="p in ports" :key="p.code" :value="p.code">{{ p.code }} – {{ p.name }}</option>
          </select>
        </div>
        <div class="filter-group" style="min-width:200px;">
          <label>Ship</label>
          <input v-model="filters.ship" placeholder="Search ship name…" @keyup.enter="resetAndSearch" @input="debouncedSearch" />
        </div>
        <div class="filter-group">
          <label>From</label>
          <input type="date" v-model="filters.date_from" @change="resetAndSearch" />
        </div>
        <div class="filter-group">
          <label>To</label>
          <input type="date" v-model="filters.date_to" @change="resetAndSearch" />
        </div>
        <div class="filter-group" style="max-width:110px;">
          <label>Berth</label>
          <input v-model="filters.berth" placeholder="e.g. FKL" @keyup.enter="resetAndSearch" />
        </div>
        <div style="display:flex; gap:6px; align-self:flex-end;">
          <button class="btn btn-primary" @click="resetAndSearch">Search</button>
          <button class="btn btn-ghost" @click="clearFilters">Clear</button>
          <button class="btn btn-ghost" style="font-size:0.75rem;" @click="exportCsv" title="Export to CSV">⬇ CSV</button>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeChips.length" class="flex gap-6 flex-wrap mt-12 pt-10 border-top">
        <span v-for="chip in activeChips" :key="chip.key"
          class="filter-chip"
          @click="clearChip(chip.key)">
          {{ chip.label }} <span style="opacity:0.6;">✕</span>
        </span>
      </div>
    </div>

    <!-- View mode + results bar -->
    <div class="view-mode-bar">
      <div class="flex gap-4">
        <button class="btn text-base" :class="viewMode==='table'?'btn-primary':'btn-ghost'" @click="viewMode='table'">☰ Table</button>
        <button class="btn text-base" :class="viewMode==='day'?'btn-primary':'btn-ghost'" @click="viewMode='day'">📅 By Day</button>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="font-mono text-base text-muted results-text">
          <template v-if="schedule && !api.loading.value">
            {{ schedule.pagination.total.toLocaleString() }} result{{ schedule.pagination.total !== 1 ? 's' : '' }}
            <span v-if="schedule.pagination.pages > 1" class="page-info"> · page {{ schedule.pagination.page }} of {{ schedule.pagination.pages }}</span>
          </template>
        </span>
        <button class="btn btn-ghost text-sm" style="white-space:nowrap;" @click="copyUrl" :title="copied ? 'Copied!' : 'Copy shareable link'">
          {{ copied ? '✅ Copied!' : '🔗 Share' }}
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <template v-if="api.loading.value">
      <div class="loading-bar" style="margin-bottom:4px;" />
      <div class="card" style="padding:0; overflow:hidden;">
        <div v-for="i in 8" :key="i" class="skeleton-row" :style="{ opacity: 1 - i * 0.1 }" />
      </div>
    </template>

    <!-- Month pills (day view only) -->
    <div v-if="viewMode==='day' && !api.loading.value && availableMonths.length" class="month-nav" style="margin-bottom:16px;">
      <button class="month-btn" :class="{ active: selectedMonth==='' }" @click="selectedMonth=''">All</button>
      <button v-for="m in availableMonths" :key="m.value"
        class="month-btn" :class="{ active: selectedMonth===m.value }"
        @click="selectedMonth=m.value">{{ m.label }}</button>
    </div>

    <!-- TABLE VIEW -->
    <template v-if="viewMode==='table' && !api.loading.value">
      <div v-if="schedule && schedule.data.length">
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th v-if="!filters.year">Year</th>
                <th>Port</th>
                <th>Ship</th>
                <th>Arrival</th>
                <th>Departure</th>
                <th>In Port</th>
                <th>Berth</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in schedule.data" :key="row.id" class="data-row" @click="clickRow(row)">
                <td style="white-space:nowrap;">{{ formatDate(row.date_iso) }}</td>
                <td style="color:var(--text-muted);">{{ row.day_of_week.slice(0,3) }}</td>
                <td v-if="!filters.year"><span class="badge badge-year">{{ row.year }}</span></td>
                <td>
                  <span class="badge badge-port" style="cursor:pointer;" @click.stop="filterPort(row.port_code)">{{ row.port_code }}</span>
                  <span style="margin-left:6px; color:var(--text-secondary); font-size:0.73rem;">{{ row.port_name }}</span>
                </td>
                <td class="ship-name" style="cursor:pointer;" @click.stop="filterShip(row.ship_name)">{{ row.ship_name }}</td>
                <td><span class="time-in">{{ row.arrival_time ?? '—' }}</span></td>
                <td><span class="time-out">{{ row.departure_time ?? '—' }}</span></td>
                <td style="color:var(--text-muted); font-size:0.78rem;">{{ hoursInPort(row.arrival_time, row.departure_time) }}</td>
                <td>
                  <span v-if="row.berth_code" class="badge badge-berth"
                    :title="berthDesc(row.berth_code)" style="cursor:help;">{{ row.berth_code }}</span>
                  <span v-else style="color:var(--text-muted);">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination">
          <div style="display:flex; align-items:center; gap:12px;">
            <span>{{ rangeStart.toLocaleString() }}–{{ rangeEnd.toLocaleString() }} of {{ schedule.pagination.total.toLocaleString() }}</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <label style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em;">Per Page:</label>
              <select v-model.number="pageSize" style="background:var(--surface-2); border:1px solid var(--navy-border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:var(--font-mono); font-size:0.78rem; padding:4px 8px; cursor:pointer;">
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
                <option :value="500">500</option>
              </select>
            </div>
          </div>
          <div class="page-controls">
            <button class="page-btn" :disabled="currentPage<=1" @click="goPage(1)">«</button>
            <button class="page-btn" :disabled="currentPage<=1" @click="goPage(currentPage-1)">‹</button>
            <button v-for="p in visiblePages" :key="p" class="page-btn" :class="{ current: p===currentPage }" @click="goPage(p)">{{ p }}</button>
            <button class="page-btn" :disabled="currentPage>=schedule.pagination.pages" @click="goPage(currentPage+1)">›</button>
            <button class="page-btn" :disabled="currentPage>=schedule.pagination.pages" @click="goPage(schedule.pagination.pages)">»</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="icon">🚢</div>
        <div>No schedule data found.</div>
        <div style="margin-top:8px; font-size:0.78rem; color:var(--text-muted);">
          Try adjusting your filters, or <router-link to="/import" style="color:var(--gold);">import PDFs</router-link> first.
        </div>
      </div>
    </template>

    <!-- DAY VIEW -->
    <template v-if="viewMode==='day' && !api.loading.value">
      <template v-if="filteredDayGroups.length">
        <div v-for="group in filteredDayGroups" :key="group.date" class="day-group">
          <div class="day-header">
            <span class="day-name">{{ group.dayOfWeek }}</span>
            <span class="day-date">{{ formatDate(group.date) }}</span>
            <span class="day-count">{{ group.calls.length }} ship{{ group.calls.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Ship</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th>In Port</th>
                  <th>Berth</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="call in group.calls" :key="call.id">
                  <td><span class="badge badge-port" style="cursor:pointer;" @click="filterPort(call.port_code)">{{ call.port_code }}</span></td>
                  <td class="ship-name" style="cursor:pointer;" @click="filterShip(call.ship_name)">{{ call.ship_name }}</td>
                  <td><span class="time-in">{{ call.arrival_time ?? '—' }}</span></td>
                  <td><span class="time-out">{{ call.departure_time ?? '—' }}</span></td>
                  <td style="color:var(--text-muted); font-size:0.78rem;">{{ hoursInPort(call.arrival_time, call.departure_time) }}</td>
                  <td>
                    <span v-if="call.berth_code" class="badge badge-berth" :title="berthDesc(call.berth_code)" style="cursor:help;">{{ call.berth_code }}</span>
                    <span v-else style="color:var(--text-muted);">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Day view pagination info -->
        <div v-if="schedule && schedule.pagination.total > 500" class="pagination" style="justify-content:center;">
          <span style="color:var(--text-muted);">Showing first 500 of {{ schedule.pagination.total.toLocaleString() }} results — switch to Table view for pagination</span>
        </div>
      </template>
      <div v-else class="empty-state">
        <div class="icon">📅</div>
        <div>No data for this period.</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useApi, type PortCall } from "../stores/api";
import { useAnalytics } from "../composables/useAnalytics";

const api = useApi();
const route = useRoute();
const router = useRouter();
const { events } = useAnalytics();

// ── URL sync helpers ──────────────────────────────────────────────────────────
function pushUrl() {
  const q: Record<string, string> = {};
  if (filters.value.year)      q.year      = filters.value.year;
  if (filters.value.port)      q.port      = filters.value.port;
  if (filters.value.ship)      q.ship      = filters.value.ship;
  if (filters.value.date_from) q.date_from = filters.value.date_from;
  if (filters.value.date_to)   q.date_to   = filters.value.date_to;
  if (filters.value.berth)     q.berth     = filters.value.berth;
  if (viewMode.value !== "table") q.view   = viewMode.value;
  if (currentPage.value > 1)   q.page      = String(currentPage.value);
  if (pageSize.value !== 100)  q.limit     = String(pageSize.value);
  router.replace({ query: q });
}

function readUrl() {
  const q = route.query;
  filters.value.year      = String(q.year      ?? "");
  filters.value.port      = String(q.port      ?? "");
  filters.value.ship      = String(q.ship      ?? "");
  filters.value.date_from = String(q.date_from ?? "");
  filters.value.date_to   = String(q.date_to   ?? "");
  filters.value.berth     = String(q.berth     ?? "");
  viewMode.value          = q.view === "day" ? "day" : "table";
  currentPage.value       = parseInt(String(q.page  ?? "1"))  || 1;
  if (q.limit) pageSize.value = parseInt(String(q.limit)) || 100;
}

// Back/forward navigation re-reads URL and reloads data
watch(() => route.query, (newQ, oldQ) => {
  if (JSON.stringify(newQ) !== JSON.stringify(oldQ)) {
    readUrl();
    loadSchedule();
  }
}, { deep: true });

const years = ref<number[]>([]);
const ports = ref<{ code: string; name: string }[]>([]);
const schedule = ref<Awaited<ReturnType<typeof api.getSchedule>>>(null);
const berthCodes = ref<Record<string, string>>({});

const viewMode = ref<"table" | "day">("table");
const currentPage = ref(1);
const pageSize = ref(parseInt(localStorage.getItem("harborwatch-page-size") || "100"));
const selectedMonth = ref<number | "">("");
const filtersExpanded = ref(false);
const copied = ref(false);

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    events.shareUrl('schedule');
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    prompt("Copy this URL:", window.location.href);
  }
}

const filters = ref({
  year: "", port: "", ship: "", date_from: "", date_to: "", berth: "",
});

// ── Active filter chips ───────────────────────────────────────────────────
const activeChips = computed(() => {
  const chips: { key: string; label: string }[] = [];
  if (filters.value.port)      chips.push({ key: "port",      label: `Port: ${filters.value.port}` });
  if (filters.value.ship)      chips.push({ key: "ship",      label: `Ship: ${filters.value.ship}` });
  if (filters.value.date_from) chips.push({ key: "date_from", label: `From: ${filters.value.date_from}` });
  if (filters.value.date_to)   chips.push({ key: "date_to",   label: `To: ${filters.value.date_to}` });
  if (filters.value.berth)     chips.push({ key: "berth",     label: `Berth: ${filters.value.berth}` });
  return chips;
});

function clearChip(key: string) {
  (filters.value as any)[key] = "";
  resetAndSearch();
}

// ── Quick date helpers ────────────────────────────────────────────────────
function jumpToToday() {
  const today = new Date().toISOString().slice(0, 10);
  filters.value.date_from = today;
  filters.value.date_to = today;
  resetAndSearch();
}

function jumpToWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  filters.value.date_from = start.toISOString().slice(0, 10);
  filters.value.date_to = end.toISOString().slice(0, 10);
  resetAndSearch();
}

// ── Inline filter clicks ──────────────────────────────────────────────────
function filterPort(code: string) {
  filters.value.port = code;
  events.filterPort(code, filters.value.year);
  resetAndSearch();
}

function filterShip(name: string) {
  filters.value.ship = name;
  events.filterShip(name, filters.value.year);
  resetAndSearch();
}

function clickRow(_row: PortCall) {
  // future: open a detail drawer
}

// ── Computed: hours in port ───────────────────────────────────────────────
function hoursInPort(arrival: string | null, departure: string | null): string {
  if (!arrival || !departure) return "—";
  const [ah, am] = arrival.split(":").map(Number);
  const [dh, dm] = departure.split(":").map(Number);
  let mins = (dh * 60 + dm) - (ah * 60 + am);
  if (mins < 0) mins += 24 * 60; // past midnight
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Berth code lookup ─────────────────────────────────────────────────────
function berthDesc(code: string): string {
  return berthCodes.value[code] ? `${code}: ${berthCodes.value[code]}` : code;
}

// ── CSV Export ────────────────────────────────────────────────────────────
async function exportCsv() {
  events.exportCsv(filters.value.year, filters.value.port);
  const params: Record<string, string | number> = { page: 1, limit: 5000 };
  if (filters.value.year)      params.year      = filters.value.year;
  if (filters.value.port)      params.port      = filters.value.port;
  if (filters.value.ship)      params.ship      = filters.value.ship;
  if (filters.value.date_from) params.date_from = filters.value.date_from;
  if (filters.value.date_to)   params.date_to   = filters.value.date_to;
  if (filters.value.berth)     params.berth     = filters.value.berth;

  const resp = await api.getSchedule(params);
  if (!resp?.data.length) return;

  const headers = ["Date","Day","Year","Port Code","Port Name","Ship","Arrival","Departure","Hours In Port","Berth"];
  const rows = resp.data.map(r => [
    r.date_iso, r.day_of_week, r.year, r.port_code, r.port_name,
    r.ship_name, r.arrival_time ?? "", r.departure_time ?? "",
    hoursInPort(r.arrival_time, r.departure_time), r.berth_code ?? "",
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `harborwatch-${filters.value.year || "all"}-${filters.value.port || "all-ports"}.csv`;
  a.click();
}

// ── Debounce ──────────────────────────────────────────────────────────────
let debounceTimer: ReturnType<typeof setTimeout>;
function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(resetAndSearch, 400);
}

function setYear(y: string) { filters.value.year = y; resetAndSearch(); }

// ── Data loading ──────────────────────────────────────────────────────────
async function loadSchedule() {
  const params: Record<string, string | number> = {
    page: viewMode.value === "day" ? 1 : currentPage.value,
    limit: viewMode.value === "day" ? 500 : pageSize.value,
  };
  if (filters.value.year)      params.year      = filters.value.year;
  if (filters.value.port)      params.port      = filters.value.port;
  if (filters.value.ship)      params.ship      = filters.value.ship;
  if (filters.value.date_from) params.date_from = filters.value.date_from;
  if (filters.value.date_to)   params.date_to   = filters.value.date_to;
  if (filters.value.berth)     params.berth     = filters.value.berth;
  schedule.value = await api.getSchedule(params);
}

function resetAndSearch() { currentPage.value = 1; pushUrl(); loadSchedule(); }

function clearFilters() {
  filters.value = { year: filters.value.year, port: "", ship: "", date_from: "", date_to: "", berth: "" };
  resetAndSearch();
}

function goPage(p: number) {
  currentPage.value = p;
  events.paginate(p);
  pushUrl();
  loadSchedule();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Pagination computed ───────────────────────────────────────────────────
const rangeStart = computed(() => schedule.value ? (currentPage.value - 1) * pageSize.value + 1 : 0);
const rangeEnd = computed(() => schedule.value ? Math.min(currentPage.value * pageSize.value, schedule.value.pagination.total) : 0);
const visiblePages = computed(() => {
  if (!schedule.value) return [];
  const total = schedule.value.pagination.pages, cur = currentPage.value;
  const pages: number[] = [];
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
  return pages;
});

// ── Day view grouping ─────────────────────────────────────────────────────
const dayGroups = computed(() => {
  if (!schedule.value) return [];
  const map = new Map<string, { date: string; dayOfWeek: string; calls: PortCall[] }>();
  for (const call of schedule.value.data) {
    if (!map.has(call.date_iso)) map.set(call.date_iso, { date: call.date_iso, dayOfWeek: call.day_of_week, calls: [] });
    map.get(call.date_iso)!.calls.push(call);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
});

const availableMonths = computed(() => {
  const months = new Set<number>();
  dayGroups.value.forEach(g => months.add(parseInt(g.date.split("-")[1])));
  const N = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from(months).sort().map(m => ({ value: m, label: N[m] }));
});

const filteredDayGroups = computed(() =>
  selectedMonth.value === "" ? dayGroups.value
    : dayGroups.value.filter(g => parseInt(g.date.split("-")[1]) === selectedMonth.value)
);

// ── Formatting ────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

watch(viewMode, (v) => { currentPage.value = 1; events.switchView(v); pushUrl(); loadSchedule(); });

onMounted(async () => {
  const [yearsData, portsData, berthData] = await Promise.all([
    api.getYears(),
    api.getPorts(),
    fetch("/api/reference/berth").then(r => r.json()).catch(() => ({ codes: [] })),
  ]);
  years.value = yearsData;
  ports.value = portsData;

  for (const { code, description } of (berthData.codes ?? [])) {
    berthCodes.value[code] = description;
  }

  // Read URL params first; only default year if not specified in URL
  readUrl();
  if (!filters.value.year && years.value.length) {
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = years.value.includes(currentYear);
    filters.value.year = String(hasCurrentYear ? currentYear : years.value[0]);
    pushUrl();
  }

  await loadSchedule();
});

watch(pageSize, (newSize) => {
  localStorage.setItem("harborwatch-page-size", String(newSize));
  resetAndSearch();
});
</script>

<style scoped>
.time-in  { color: var(--green-ok); font-family: var(--font-mono); }
.time-out { color: var(--red-alert); font-family: var(--font-mono); }

.data-row { cursor: default; }
.data-row:hover .ship-name { color: var(--gold); }

.view-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.results-text {
  white-space: nowrap;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border-radius: 2px;
  background: var(--gold-glow);
  border: 1px solid var(--gold-dim);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--gold);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip:hover {
  background: var(--gold-dim);
  transform: translateY(-1px);
}

.skeleton-row {
  height: 40px;
  background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-bottom: 1px solid var(--navy-border);
}

/* Pagination limit selector */
.pagination select {
  transition: border-color 0.2s, box-shadow 0.2s;
}
.pagination select:hover {
  border-color: var(--gold-dim);
}
.pagination select:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold-glow);
}
.pagination select option {
  background: var(--surface-2);
  color: var(--text-primary);
}

/* Mobile collapsible filters */
.mobile-filter-toggle {
  display: none;
  width: 100%;
  padding: 12px 16px;
  background: var(--surface-2);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  margin-bottom: 12px;
  transition: background 0.2s;
  justify-content: space-between;
  align-items: center;
}

.mobile-filter-toggle:hover {
  background: var(--surface-3);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--gold-glow);
  border: 1px solid var(--gold-dim);
  border-radius: 10px;
  color: var(--gold);
  font-size: 0.7rem;
  font-weight: 600;
}

@media (max-width: 768px) {
  .mobile-filter-toggle {
    display: flex;
  }

  .filters-bar {
    display: none;
    flex-direction: column;
    gap: 12px;
  }

  .filters-bar.expanded {
    display: flex;
  }

  .filters-bar .filter-group {
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
  }

  .filters-bar > div:last-child {
    flex-direction: row;
    width: 100%;
  }

  .filters-bar > div:last-child button {
    flex: 1;
  }

  /* View mode bar - stack on mobile */
  .view-mode-bar {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px;
  }

  .results-text {
    white-space: normal;
  }
}
</style>
