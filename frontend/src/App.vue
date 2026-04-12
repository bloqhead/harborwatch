<template>
  <div id="app-root">
    <nav class="nav">
      <div class="nav-inner">
        <router-link to="/" class="nav-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="opacity:0.85">
            <path d="M12 2C8 2 4 5 4 9c0 5 8 13 8 13s8-8 8-13c0-4-3.6-7-8-7z" stroke="#c8a84b" stroke-width="1.5" fill="rgba(200,168,75,0.12)"/>
            <circle cx="12" cy="9" r="2.5" stroke="#c8a84b" stroke-width="1.5"/>
            <path d="M3 20h18M7 20v-3M12 20v-4M17 20v-3" stroke="#4fc3d8" stroke-width="1.2" opacity="0.6"/>
          </svg>
          <span>Harborwatch</span>
        </router-link>

        <div class="nav-links">
          <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
            <span class="nav-icon">☰</span> Schedule
          </router-link>
          <router-link to="/map" class="nav-link" :class="{ active: $route.path === '/map' }">
            <span class="nav-icon">🗺</span> Map
          </router-link>
          <router-link to="/stats" class="nav-link" :class="{ active: $route.path === '/stats' }">
            <span class="nav-icon">📊</span> Stats
          </router-link>
        </div>

        <button @click="themeStore.toggleTheme()" class="theme-toggle" :title="themeStore.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <span v-if="themeStore.theme === 'dark'">☀️</span>
          <span v-else>🌙</span>
        </button>

        <div class="nav-source">
          <a href="https://claalaska.com" target="_blank" rel="noopener" class="source-link">
            SOURCE: CLAALASKA.COM ↗
          </a>
        </div>
      </div>
    </nav>

    <main style="flex:1; padding:28px 0;">
      <div class="container">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <footer>
      <div style="max-width:1400px; margin:0 auto; padding:0 24px; display:flex; align-items:center; justify-content:space-between;">
        <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted); letter-spacing:0.08em; text-transform:uppercase;">
          Data: Cruise Line Agencies of Alaska S.E. Inc.
        </span>
        <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--text-muted); letter-spacing:0.08em; text-transform:uppercase; opacity:0.5;">
          Not affiliated with CLA Alaska
        </span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
</script>

<style>
#app-root { min-height:100vh; display:flex; flex-direction:column; }

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--navy-border);
  background: var(--surface-2);
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
  margin-left: 8px;
}

.theme-toggle:hover {
  background: var(--surface-3);
  border-color: var(--gold-dim);
  transform: scale(1.05);
}

.theme-toggle span {
  display: block;
  line-height: 1;
}

.nav-source { margin-left: 12px; }

.source-link {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--text-muted);
  text-decoration: none;
  letter-spacing: 0.06em;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.source-link:hover { opacity: 1; }

footer {
  border-top:1px solid var(--navy-border);
  padding:12px 0;
  background:var(--navy-deepest);
}

.fade-enter-active, .fade-leave-active { transition:opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity:0; }

.nav-icon { font-size:0.9em; }
</style>
