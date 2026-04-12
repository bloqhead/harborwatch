import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'dark' | 'light'>('dark');

  // Initialize from localStorage or default to dark
  const savedTheme = localStorage.getItem('harborwatch-theme') as 'dark' | 'light' | null;
  if (savedTheme) {
    theme.value = savedTheme;
  }

  // Apply theme to document
  function applyTheme() {
    if (theme.value === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Toggle theme
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }

  // Watch for theme changes and persist
  watch(theme, (newTheme) => {
    localStorage.setItem('harborwatch-theme', newTheme);
    applyTheme();
  }, { immediate: true });

  return {
    theme,
    toggleTheme,
  };
});
