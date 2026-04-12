<template>
  <div>
    <div class="flex-align-end flex-justify-between mb-24 flex-wrap gap-12">
      <div>
        <h1 class="mb-4">Statistics</h1>
        <p class="text-muted font-mono text-base letter-spacing-sm">
          PORT CALL ANALYTICS &amp; ACTIVITY SUMMARY
        </p>
      </div>

      <!-- Desktop: Tabs -->
      <div class="year-tabs desktop-only">
        <button v-for="y in years" :key="y"
          class="year-tab" :class="{ active: selectedYear===String(y) }"
          @click="selectedYear=String(y)">{{ y }}</button>
        <button class="year-tab" :class="{ active: selectedYear==='' }" @click="selectedYear=''">All</button>
      </div>

      <!-- Mobile: Dropdown -->
      <div class="year-select-mobile mobile-only">
        <label class="mono-muted-label mr-6">Year:</label>
        <select v-model="selectedYear" class="select-style">
          <option value="">All Years</option>
          <option v-for="y in years" :key="y" :value="String(y)">{{ y }}</option>
        </select>
      </div>
    </div>

    <div v-if="api.loading.value" class="loading-bar mb-16" />

    <template v-if="stats">
      <!-- Top stat cards -->
      <div class="stat-grid" style="margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalCalls.toLocaleString() }}</div>
          <div class="stat-label">Total Port Calls</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.uniqueShips }}</div>
          <div class="stat-label">Unique Ships</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.uniquePorts }}</div>
          <div class="stat-label">Active Ports</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ peakMonth.label }}</div>
          <div class="stat-label">Busiest Month · {{ peakMonth.calls.toLocaleString() }} calls</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ peakDay.day }}</div>
          <div class="stat-label">Busiest Day-of-Week · {{ peakDay.calls.toLocaleString() }} calls</div>
        </div>
      </div>

      <!-- Row 1: Monthly bars + Port ranking -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
        <!-- Monthly activity -->
        <div class="card">
          <div class="card-header">
            <h3>Monthly Activity</h3>
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">Calls per month</span>
          </div>
          <div class="month-bars" style="height:140px;">
            <div v-for="m in fullMonthData" :key="m.month" class="month-col">
              <div class="month-val" style="font-size:0.6rem;">{{ m.calls || '' }}</div>
              <div class="month-bar"
                :style="{ height: m.calls ? (m.calls / maxMonthCalls * 110)+'px' : '2px', opacity: m.calls ? 1 : 0.15,
                          background: m.month === peakMonth.month ? 'linear-gradient(180deg, var(--gold-bright), var(--gold))' : 'linear-gradient(180deg, var(--gold), var(--gold-dim))' }" />
              <div class="month-lbl">{{ m.label }}</div>
            </div>
          </div>
        </div>

        <!-- Day of week breakdown -->
        <div class="card">
          <div class="card-header">
            <h3>By Day of Week</h3>
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">Total calls</span>
          </div>
          <div class="bar-chart">
            <div v-for="d in orderedDays" :key="d.day" class="bar-row">
              <div class="bar-label" style="width:96px;">{{ d.day }}</div>
              <div class="bar-track">
                <div class="bar-fill"
                  :style="{ width: (d.calls / maxDayCalls * 100)+'%',
                            background: d.day === peakDay.day ? 'linear-gradient(90deg, var(--gold-dim), var(--gold-bright))' : 'linear-gradient(90deg, var(--gold-dim), var(--gold))' }" />
              </div>
              <div class="bar-value">{{ d.calls.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Top ports + Top ships -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        <!-- Top ports -->
        <div class="card">
          <div class="card-header">
            <h3>Busiest Ports</h3>
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">Top 10 by calls</span>
          </div>
          <div class="bar-chart">
            <div v-for="port in stats.topPorts" :key="port.code" class="bar-row">
              <div class="bar-label" :title="port.name">
                <router-link :to="`/?port=${port.code}&year=${selectedYear}`"
                  style="text-decoration:none;">
                  <span class="badge badge-port" style="font-size:0.62rem; padding:1px 5px;">{{ port.code }}</span>
                </router-link>
                <span style="margin-left:4px; color:var(--text-secondary); font-size:0.7rem;">{{ port.name }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: (port.calls / stats.topPorts[0].calls * 100)+'%' }" />
              </div>
              <div class="bar-value">{{ port.calls.toLocaleString() }}</div>
            </div>
          </div>
        </div>

        <!-- Top ships -->
        <div class="card">
          <div class="card-header">
            <h3>Most Active Ships</h3>
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">Top 15 by calls</span>
          </div>
          <div class="bar-chart">
            <div v-for="ship in stats.topShips" :key="ship.name" class="bar-row">
              <div class="bar-label" :title="ship.name" style="width:180px;">
                <router-link :to="`/?ship=${encodeURIComponent(ship.name)}&year=${selectedYear}`"
                  style="text-decoration:none; color:var(--text-secondary); font-size:0.73rem;">
                  {{ ship.name }}
                </router-link>
              </div>
              <div class="bar-track">
                <div class="bar-fill"
                  :style="{ width: (ship.calls / stats.topShips[0].calls * 100)+'%',
                            background: 'linear-gradient(90deg, var(--cyan-dim), var(--cyan-accent))' }" />
              </div>
              <div class="bar-value">{{ ship.calls.toLocaleString() }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="!api.loading.value" class="empty-state">
      <div class="icon">📊</div>
      <div>No data yet.</div>
      <div style="margin-top:8px; font-size:0.78rem;">
        <router-link to="/import" style="color:var(--gold);">Import schedules</router-link> to see stats.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useApi, type Stats } from "../stores/api";

const api = useApi();
const years = ref<number[]>([]);
const stats = ref<Stats | null>(null);
const selectedYear = ref("");

const MONTH_LABELS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ORDER = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const fullMonthData = computed(() => {
  if (!stats.value) return [];
  const map = new Map<number, number>();
  stats.value.byMonth.forEach(m => map.set(m.month, m.calls));
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, label: MONTH_LABELS[i + 1], calls: map.get(i + 1) ?? 0,
  }));
});

const maxMonthCalls = computed(() => Math.max(...fullMonthData.value.map(m => m.calls), 1));

const peakMonth = computed(() => {
  const best = fullMonthData.value.reduce((a, b) => b.calls > a.calls ? b : a, { month: 0, label: "—", calls: 0 });
  return best;
});

const orderedDays = computed(() => {
  if (!stats.value?.byDayOfWeek) return [];
  const map = new Map<string, number>();
  stats.value.byDayOfWeek.forEach(d => map.set(d.day, d.calls));
  return DAY_ORDER.map(day => ({ day, calls: map.get(day) ?? 0 }));
});

const maxDayCalls = computed(() => Math.max(...orderedDays.value.map(d => d.calls), 1));

const peakDay = computed(() => {
  return orderedDays.value.reduce((a, b) => b.calls > a.calls ? b : a, { day: "—", calls: 0 });
});

async function loadStats() {
  stats.value = await api.getStats(selectedYear.value || undefined);
}

watch(selectedYear, loadStats);

onMounted(async () => {
  years.value = await api.getYears();
  if (years.value.length) {
    // Default to current year if available, otherwise use the first year
    const currentYear = new Date().getFullYear();
    const hasCurrentYear = years.value.includes(currentYear);
    selectedYear.value = String(hasCurrentYear ? currentYear : years.value[0]);
  }
  await loadStats();
});
</script>
