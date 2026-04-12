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

        <!-- Desktop navigation -->
        <div class="nav-links desktop-nav">
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

        <!-- Mobile menu button -->
        <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen" :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'">
          <span v-if="!mobileMenuOpen">☰</span>
          <span v-else>✕</span>
        </button>

        <div class="nav-source desktop-nav">
          <a href="https://claalaska.com" target="_blank" rel="noopener" class="source-link">
            SOURCE: CLAALASKA.COM ↗
          </a>
        </div>
      </div>

      <!-- Mobile menu overlay -->
      <transition name="mobile-menu">
        <div v-if="mobileMenuOpen" class="mobile-menu-overlay" @click="mobileMenuOpen = false">
          <div class="mobile-menu" @click.stop>
            <router-link to="/" class="mobile-menu-link" :class="{ active: $route.path === '/' }" @click="mobileMenuOpen = false">
              <span class="nav-icon">☰</span> Schedule
            </router-link>
            <router-link to="/map" class="mobile-menu-link" :class="{ active: $route.path === '/map' }" @click="mobileMenuOpen = false">
              <span class="nav-icon">🗺</span> Map
            </router-link>
            <router-link to="/stats" class="mobile-menu-link" :class="{ active: $route.path === '/stats' }" @click="mobileMenuOpen = false">
              <span class="nav-icon">📊</span> Stats
            </router-link>
            <div class="mobile-menu-divider"></div>
            <a href="https://claalaska.com" target="_blank" rel="noopener" class="mobile-menu-link source">
              SOURCE: CLAALASKA.COM ↗
            </a>
          </div>
        </div>
      </transition>
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
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();
const mobileMenuOpen = ref(false);
const route = useRoute();

// Close mobile menu when route changes
watch(() => route.path, () => {
  mobileMenuOpen.value = false;
});
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

/* Mobile menu button */
.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--navy-border);
  background: var(--surface-2);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1.3rem;
  transition: all 0.2s;
  margin-left: 8px;
}

.mobile-menu-btn:hover {
  background: var(--surface-3);
  border-color: var(--gold-dim);
}

/* Mobile menu overlay */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(5, 13, 26, 0.85);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-top: 60px;
}

.mobile-menu {
  background: var(--surface-1);
  border: 1px solid var(--navy-border);
  border-radius: var(--radius-md);
  margin: 0 12px;
  min-width: 280px;
  max-width: 90%;
  box-shadow: var(--shadow-deep);
  overflow: hidden;
}

.mobile-menu-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  color: var(--text-secondary);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--navy-border);
  transition: all 0.2s;
}

.mobile-menu-link:last-child {
  border-bottom: none;
}

.mobile-menu-link:hover {
  background: var(--surface-2);
  color: var(--gold);
}

.mobile-menu-link.active {
  background: var(--gold-glow);
  color: var(--gold-bright);
  border-left: 3px solid var(--gold);
}

.mobile-menu-link.source {
  font-size: 0.7rem;
  color: var(--text-muted);
  opacity: 0.8;
  padding: 12px 20px;
}

.mobile-menu-divider {
  height: 1px;
  background: var(--navy-border);
  margin: 8px 0;
}

/* Mobile menu transitions */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.25s ease;
}

.mobile-menu-enter-active .mobile-menu,
.mobile-menu-leave-active .mobile-menu {
  transition: transform 0.25s ease;
}

.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
}

.mobile-menu-enter-from .mobile-menu {
  transform: translateX(100%);
}

.mobile-menu-leave-to .mobile-menu {
  transform: translateX(100%);
}

/* Mobile navigation */
@media (max-width: 768px) {
  /* Hide desktop nav items */
  .desktop-nav {
    display: none !important;
  }

  /* Show mobile menu button */
  .mobile-menu-btn {
    display: flex;
  }

  /* Right-align theme toggle and menu button on mobile */
  .nav-inner {
    justify-content: space-between;
  }

  .theme-toggle {
    margin-left: auto;
  }

  /* Ensure close button stays above overlay */
  .mobile-menu-btn {
    position: relative;
    z-index: 10000;
  }

  footer > div {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  footer span {
    font-size: 0.6rem !important;
  }
}
</style>
