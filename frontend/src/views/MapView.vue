<template>
  <div>
    <!-- Header -->
    <div class="flex-align-end flex-justify-between mb-20 gap-12">
      <div>
        <h1 class="mb-4">Port Map</h1>
        <p class="font-mono text-md text-muted letter-spacing-sm">
          CLICK A PORT TO SEE ITS SCHEDULE
        </p>
      </div>

      <!-- Desktop: Tabs -->
      <div class="year-tabs desktop-only">
        <button v-for="y in years" :key="y"
          class="year-tab" :class="{ active: selectedYear === String(y) }"
          @click="selectedYear = String(y); loadPortStats()">{{ y }}</button>
        <button class="year-tab" :class="{ active: selectedYear === '' }"
          @click="selectedYear = ''; loadPortStats()">All</button>
      </div>

      <!-- Mobile: Dropdown -->
      <div class="year-select-mobile mobile-only">
        <label class="mono-muted-label mr-6">Year:</label>
        <select v-model="selectedYear" @change="loadPortStats()" class="select-style">
          <option value="">All Years</option>
          <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
        </select>
      </div>
    </div>

    <div class="map-layout">

      <!-- Map container -->
      <div class="card p-0 overflow-hidden relative">
        <div ref="mapEl" style="height:580px; width:100%; border-radius:var(--radius-md);" />

        <!-- Legend -->
        <div class="map-legend absolute" style="bottom:16px; left:16px; z-index:1000;">
          <div class="mono-heading mb-8">Regions</div>
          <div v-for="(color, region) in REGION_COLORS" :key="region"
            class="flex-align-center gap-8 cursor-pointer font-mono text-sm text-secondary"
            style="margin-bottom:5px;"
            @click="filterRegion(region)">
            <div :style="{ width:'10px', height:'10px', borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }" />
            {{ regionLabel(region) }}
          </div>
          <div class="flex-align-center gap-8 mt-8 pt-8 border-top mono-muted-xs cursor-pointer" @click="clearRegionFilter">
            ✕ Show all
          </div>
        </div>

        <!-- Bubble size legend -->
        <div class="map-legend absolute" style="bottom:16px; right:16px; z-index:1000;">
          <div class="mono-heading mb-8">Circle = call volume</div>
          <div v-for="lv in sizeLegend" :key="lv.label" class="flex-align-center gap-8" style="margin-bottom:5px;">
            <div :style="{ width: lv.r*2+'px', height: lv.r*2+'px', borderRadius:'50%', background:'rgba(200,168,75,0.3)', border:'1px solid var(--gold)', flexShrink:0 }" />
            <span class="font-mono text-muted" style="font-size:0.68rem;">{{ lv.label }}</span>
          </div>
        </div>
      </div>

      <!-- Side panel -->
      <div>
        <!-- Selected port detail -->
        <div v-if="selectedPort" class="card" style="margin-bottom:16px;">
          <div class="card-header" style="margin-bottom:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span class="badge badge-port" style="font-size:0.85rem; padding:3px 10px;">{{ selectedPort.code }}</span>
                <h2 style="font-size:1.1rem;">{{ selectedPort.name }}</h2>
              </div>
              <div v-if="selectedPort.description" style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); font-style:italic;">
                {{ selectedPort.description }}
              </div>
            </div>
            <button class="btn btn-ghost" style="font-size:0.7rem; padding:4px 8px;" @click="clearPort">✕</button>
          </div>

          <!-- Port stats -->
          <div v-if="portDetail" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
            <div style="background:var(--surface-3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-family:var(--font-display); font-size:1.6rem; color:var(--gold-bright);">{{ portDetail.totalCalls }}</div>
              <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em;">Port Calls</div>
            </div>
            <div style="background:var(--surface-3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-family:var(--font-display); font-size:1.6rem; color:var(--gold-bright);">{{ portDetail.uniqueShips }}</div>
              <div style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em;">Unique Ships</div>
            </div>
          </div>

          <!-- Top ships at this port -->
          <div v-if="portDetail && portDetail.topShips.length">
            <div style="font-family:var(--font-mono); font-size:0.68rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Top Ships</div>
            <div v-for="s in portDetail.topShips.slice(0,6)" :key="s.name"
              style="display:flex; align-items:center; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(30,64,112,0.3);">
              <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">{{ s.name }}</span>
              <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--gold-dim);">{{ s.calls }}×</span>
            </div>
          </div>

          <!-- View schedule button -->
          <router-link :to="`/?port=${selectedPort.code}&year=${selectedYear}`" class="btn btn-primary" style="width:100%; justify-content:center; margin-top:14px; text-decoration:none;">
            View Full Schedule →
          </router-link>
        </div>

        <!-- Port list (when nothing selected) -->
        <div v-else class="card">
          <div class="card-header">
            <h3>All Ports</h3>
            <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted);">{{ filteredPortList.length }} shown</span>
          </div>
          <div style="max-height:480px; overflow-y:auto;">
            <div v-for="p in filteredPortList" :key="p.code"
              style="display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid rgba(30,64,112,0.3); cursor:pointer; transition:background 0.15s; border-radius:var(--radius-sm);"
              @click="selectPort(p)"
              @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background='var(--surface-3)'"
              @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background='transparent'">
              <div :style="{ width:'8px', height:'8px', borderRadius:'50%', background:REGION_COLORS[p.region], flexShrink:0 }" />
              <span class="badge badge-port" style="font-size:0.68rem;">{{ p.code }}</span>
              <span style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-secondary); flex:1;">{{ p.name }}</span>
              <span v-if="portCallCounts[p.code]" style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">
                {{ portCallCounts[p.code] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PORT_GEO, REGION_COLORS, type PortGeo } from "../data/ports";
import { useThemeStore } from "../stores/theme";
import { useApi } from "../stores/api";
import { useAnalytics } from "../composables/useAnalytics";

const themeStore = useThemeStore();
const api = useApi();
const route = useRoute();
const router = useRouter();
const { events } = useAnalytics();
const mapEl = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let markers: L.CircleMarker[] = [];
let tileLayer: L.TileLayer | null = null;

const years = ref<number[]>([]);
const selectedYear = ref("");
const selectedPort = ref<PortGeo | null>(null);
const regionFilter = ref<string | null>(null);
const portCallCounts = ref<Record<string, number>>({});

interface PortDetail {
  totalCalls: number;
  uniqueShips: number;
  topShips: { name: string; calls: number }[];
}
const portDetail = ref<PortDetail | null>(null);

const sizeLegend = [
  { r: 6,  label: "< 50 calls" },
  { r: 10, label: "50–200 calls" },
  { r: 16, label: "200+ calls" },
];

function regionLabel(r: string) {
  return { southeast:"Southeast AK", southcentral:"Southcentral AK", western:"Western AK", pacific_northwest:"Pacific NW" }[r] ?? r;
}

const filteredPortList = computed(() => {
  return Object.values(PORT_GEO)
    .filter(p => !regionFilter.value || p.region === regionFilter.value)
    .sort((a, b) => (portCallCounts.value[b.code] ?? 0) - (portCallCounts.value[a.code] ?? 0));
});

function filterRegion(region: string) {
  regionFilter.value = region === regionFilter.value ? null : region;
  if (regionFilter.value) events.mapRegionFilter(region);
  renderMarkers();
}

function clearRegionFilter() {
  regionFilter.value = null;
  renderMarkers();
}

function markerRadius(calls: number): number {
  if (calls === 0) return 5;
  if (calls < 50) return 7;
  if (calls < 150) return 11;
  if (calls < 300) return 16;
  return 20;
}

function renderMarkers() {
  if (!map) return;
  markers.forEach(m => m.remove());
  markers = [];

  const allPorts = Object.values(PORT_GEO);

  for (const port of allPorts) {
    if (regionFilter.value && port.region !== regionFilter.value) continue;

    const calls = portCallCounts.value[port.code] ?? 0;
    const color = REGION_COLORS[port.region];
    const r = markerRadius(calls);
    const isSelected = selectedPort.value?.code === port.code;

    const marker = L.circleMarker([port.lat, port.lng], {
      radius: r,
      fillColor: color,
      fillOpacity: calls > 0 ? 0.75 : 0.2,
      color: isSelected ? "#e6c96e" : color,
      weight: isSelected ? 3 : 1.5,
    });

    marker.bindTooltip(`
      <div style="font-family:monospace; font-size:12px; line-height:1.5; color: var(--text-primary);">
        <strong style="color:${color}">${port.code}</strong> — ${port.name}<br/>
        ${calls > 0 ? `<span style="opacity: 0.7">${calls} port calls</span>` : '<span style="opacity: 0.5">no data loaded</span>'}
      </div>
    `, { sticky: true, opacity: 0.95 });

    marker.on("click", () => selectPort(port));
    marker.addTo(map);
    markers.push(marker);
  }
}

function clearPort() {
  selectedPort.value = null;
  portDetail.value = null;
  pushMapUrl();
  renderMarkers();
}

async function selectPort(port: PortGeo) {
  selectedPort.value = port;
  portDetail.value = null;
  pushMapUrl();
  events.mapPortClick(port.code, selectedYear.value);
  map?.panTo([port.lat, port.lng], { animate: true, duration: 0.5 });
  renderMarkers();

  const data = await api.getPortDetail(port.code, selectedYear.value || undefined);
  if (data) {
    portDetail.value = {
      totalCalls: data.totalCalls,
      uniqueShips: data.uniqueShips,
      topShips: data.topShips ?? [],
    };
  }
}

async function loadPortStats() {
  const resp = await api.getStats(selectedYear.value || undefined);
  if (!resp) return;

  const counts: Record<string, number> = {};
  for (const p of (resp.allPorts ?? resp.topPorts ?? [])) {
    counts[p.code] = p.calls;
  }
  portCallCounts.value = counts;
  renderMarkers();
}

function updateTileLayer() {
  if (!map) return;

  // Remove existing tile layer if present
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  // Select tile layer based on theme
  const tileUrl = themeStore.theme === 'dark'
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  tileLayer = L.tileLayer(tileUrl, {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  });

  tileLayer.addTo(map);
}

function initMap() {
  if (!mapEl.value) return;

  map = L.map(mapEl.value, {
    center: [60, -145],
    zoom: 4,
    zoomControl: true,
    attributionControl: true,
  });

  updateTileLayer();
  renderMarkers();
}

function pushMapUrl() {
  const q: Record<string, string> = {};
  if (selectedYear.value)   q.year = selectedYear.value;
  if (selectedPort.value)   q.port = selectedPort.value.code;
  router.replace({ query: q });
}

watch(selectedYear, () => {
  pushMapUrl();
  loadPortStats();
  if (selectedPort.value) selectPort(selectedPort.value);
});

// Watch for theme changes and update map tiles
watch(() => themeStore.theme, () => {
  updateTileLayer();
});

onMounted(async () => {
  const yr = await api.getYears();
  years.value = yr ?? [];

  // Read URL params first
  if (route.query.year) {
    selectedYear.value = String(route.query.year);
  } else if (years.value.length > 0) {
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = years.value.includes(currentYear);
    selectedYear.value = String(hasCurrentYear ? currentYear : years.value[0]);
  }

  // Init map after DOM is ready
  await new Promise(r => setTimeout(r, 50));
  initMap();
  await loadPortStats();

  // Auto-select port from URL after stats are loaded
  if (route.query.port) {
    const portCode = String(route.query.port).toUpperCase();
    const portGeo = PORT_GEO[portCode];
    if (portGeo) selectPort(portGeo);
  }
});

onUnmounted(() => {
  map?.remove();
  map = null;
});
</script>

<style scoped>
.map-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  align-items: start;
  position: relative;
  z-index: 1;
}

.map-legend {
  background: var(--surface-1);
  border: 1px solid var(--navy-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-deep);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  position: relative;
  z-index: 400;
}

@media (max-width: 968px) {
  .map-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .map-legend {
    font-size: 0.7rem;
    padding: 8px 10px;
  }
}

/* Override Leaflet popup/tooltip styles to match theme */
:deep(.leaflet-tooltip) {
  background: var(--surface-1) !important;
  border: 1px solid var(--navy-border) !important;
  color: var(--text-primary) !important;
  border-radius: 4px !important;
  box-shadow: var(--shadow-deep) !important;
  padding: 8px 12px !important;
}
:deep(.leaflet-tooltip-top:before) { border-top-color: var(--navy-border) !important; }

:deep(.leaflet-control-zoom a) {
  background: var(--surface-2) !important;
  color: var(--text-secondary) !important;
  border-color: var(--navy-border) !important;
  transition: background-color 0.2s, color 0.2s !important;
}
:deep(.leaflet-control-zoom a:hover) {
  background: var(--surface-3) !important;
  color: var(--gold) !important;
}

:deep(.leaflet-control-attribution) {
  background: var(--surface-1) !important;
  color: var(--text-muted) !important;
  font-size: 0.6rem !important;
  opacity: 0.8;
  transition: background-color 0.3s ease !important;
}
:deep(.leaflet-control-attribution a) {
  color: var(--text-muted) !important;
}
</style>
