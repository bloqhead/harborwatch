/**
 * useAnalytics — type-safe wrapper around Umami's window.umami
 *
 * All calls are no-ops if:
 *   - VITE_UMAMI_SITE_ID is not set (local dev)
 *   - The Umami script hasn't loaded yet
 *   - Umami is blocked by an ad blocker
 *
 * Usage:
 *   const { track } = useAnalytics()
 *   track('filter_port', { port: 'JNU', year: '2026' })
 */

// Extend Window type for Umami
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, string | number | boolean>) => void;
    };
  }
}

export function useAnalytics() {
  function track(eventName: string, data?: Record<string, string | number | boolean>) {
    try {
      window.umami?.track(eventName, data);
    } catch {
      // Never let analytics errors bubble up and break the app
    }
  }

  // Convenience wrappers for known Harborwatch events
  const events = {
    // Schedule view
    filterPort:   (port: string, year?: string) =>
      track('filter_port', { port, ...(year ? { year } : {}) }),

    filterShip:   (ship: string, year?: string) =>
      track('filter_ship', { ship: ship.slice(0, 50), ...(year ? { year } : {}) }),

    filterBerth:  (berth: string) =>
      track('filter_berth', { berth }),

    filterDate:   (range: 'today' | 'week' | 'custom') =>
      track('filter_date', { range }),

    exportCsv:    (year: string, port: string) =>
      track('export_csv', { year: year || 'all', port: port || 'all' }),

    switchView:   (view: 'table' | 'day') =>
      track('switch_view', { view }),

    paginate:     (page: number) =>
      track('paginate', { page }),

    // Map view
    mapPortClick: (port: string, year?: string) =>
      track('map_port_click', { port, ...(year ? { year } : {}) }),

    mapRegionFilter: (region: string) =>
      track('map_region_filter', { region }),

    // Stats view
    statsYearSwitch: (year: string) =>
      track('stats_year_switch', { year: year || 'all' }),

    statsPortLink:  (port: string) =>
      track('stats_port_link', { port }),

    statsShipLink:  (ship: string) =>
      track('stats_ship_link', { ship: ship.slice(0, 50) }),

    // Navigation
    shareUrl:     (page: string) =>
      track('share_url', { page }),

    // Ship detail
    shipView:         (ship: string) =>
      track('ship_view', { ship: ship.slice(0, 50) }),

    shipExternalLink: (ship: string, destination: 'marinetraffic' | 'shipmapper' | 'vesselfinder') =>
      track('ship_external_link', { ship: ship.slice(0, 50), destination }),

    shipYearSwitch:   (ship: string, year: string) =>
      track('ship_year_switch', { ship: ship.slice(0, 50), year }),

    shipShareUrl:     (ship: string) =>
      track('share_url', { page: 'ship', ship: ship.slice(0, 50) }),
  };

  return { track, events };
}
