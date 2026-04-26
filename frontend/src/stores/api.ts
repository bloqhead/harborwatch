// src/stores/api.ts
import { ref } from "vue";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://harborwatch-api.onrender.com") + "/api";

export interface PortCall {
  id: number;
  year: number;
  port_code: string;
  port_name: string;
  ship_name: string;
  date_str: string;
  date_iso: string;
  arrival_time: string | null;
  departure_time: string | null;
  berth_code: string | null;
  day_of_week: string;
}

export interface ScheduleResponse {
  data: PortCall[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Stats {
  totalCalls: number;
  uniqueShips: number;
  uniquePorts: number;
  topPorts: { code: string; name: string; calls: number }[];
  allPorts?: { code: string; name: string; calls: number }[];
  topShips: { name: string; calls: number }[];
  byMonth: { month: number; calls: number }[];
  byDayOfWeek: { day: string; calls: number }[];
}

export interface ShipMetadata {
  imo: string | null;
  cruise_line: string | null;
  flag: string | null;
  gross_tonnage: number | null;
  passengers: number | null;
  crew: number | null;
  year_built: number | null;
  length_m: number | null;
  beam_m: number | null;
  homeport: string | null;
  notes: string | null;
  mt_url: string | null;
}

export interface ShipPortCall {
  date_iso: string;
  port_code: string;
  arrival_time: string | null;
  departure_time: string | null;
  berth_code: string | null;
  day_of_week: string;
}

export interface ShipDetail {
  name: string;
  totalCalls: number;
  uniquePorts: number;
  yearsActive: number[];
  firstCall: { date: string; port: string } | null;
  lastCall:  { date: string; port: string } | null;
  portCalls: ShipPortCall[];
  topPorts: { code: string; name: string; calls: number }[];
  byMonth: { month: number; calls: number }[];
  metadata: ShipMetadata | null;
}

export function useApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchJson<T>(path: string): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(API_BASE + path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json() as T;
    } catch (e) {
      error.value = String(e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getYears(): Promise<number[]> {
    const r = await fetchJson<{ years: number[] }>("/years");
    return r?.years ?? [];
  }

  async function getPorts(): Promise<{ code: string; name: string }[]> {
    const r = await fetchJson<{ ports: { code: string; name: string }[] }>("/ports");
    return r?.ports ?? [];
  }

  async function getShips(): Promise<string[]> {
    const r = await fetchJson<{ ships: string[] }>("/ships");
    return r?.ships ?? [];
  }

  async function getSchedule(params: {
    year?: number | string;
    port?: string;
    ship?: string;
    date_from?: string;
    date_to?: string;
    berth?: string;
    page?: number;
    limit?: number;
  }): Promise<ScheduleResponse | null> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    });
    return fetchJson<ScheduleResponse>(`/schedule?${qs}`);
  }

  async function getStats(year?: number | string): Promise<Stats | null> {
    const qs = year ? `?year=${year}` : "";
    return fetchJson<Stats>(`/stats${qs}`);
  }

  async function getPortDetail(portCode: string, year?: number | string): Promise<{ totalCalls: number; uniqueShips: number; topShips: { name: string; calls: number }[] } | null> {
    const qs = year ? `?year=${year}` : "";
    return fetchJson(`/port/${portCode}${qs}`);
  }

  async function importRecords(records: unknown[], apiKey?: string): Promise<{ inserted: number; skipped: number } | null> {
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(API_BASE + "/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ records }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      error.value = String(e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getShipDetail(name: string, year?: string): Promise<ShipDetail | null> {
    const qs = year ? `?year=${year}` : "";
    return fetchJson<ShipDetail>(`/ship/${encodeURIComponent(name)}${qs}`);
  }

  return { loading, error, getYears, getPorts, getShips, getSchedule, getStats, getPortDetail, getShipDetail, importRecords };
}
