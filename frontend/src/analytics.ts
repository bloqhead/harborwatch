// analytics.ts — loads Umami tracking script
// Vite replaces import.meta.env.* at build time, so this works correctly
// in production even though the values come from environment variables.

const siteId = import.meta.env.VITE_UMAMI_SITE_ID as string | undefined;
const umamiUrl = (import.meta.env.VITE_UMAMI_URL as string | undefined)
  ?? "https://harborwatch-analytics.onrender.com";

if (siteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.setAttribute("data-website-id", siteId);
  script.src = `${umamiUrl}/script.js`;
  document.head.appendChild(script);
}
