/**
 * Turns a `stores` row into the live look of the page: CSS variables, Google
 * Fonts, favicon, title. This is what makes one codebase look different for
 * every client — nothing here is hardcoded per business.
 */
(function () {
  function hexToRgb(hex) {
    const h = hex.replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bb = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bb})`;
  }

  function shade(hex, amount) {
    // amount: -1..1, negative darkens toward black, positive lightens toward white
    return amount < 0 ? mix(hex, '#000000', -amount) : mix(hex, '#ffffff', amount);
  }

  function loadGoogleFont(family) {
    if (!family) return;
    const id = 'gfont-' + family.replace(/\s+/g, '-').toLowerCase();
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  /**
   * @param {object} store - a row from public.stores
   */
  window.applyTheme = function applyTheme(store) {
    const isDark = (store.theme_mode || 'dark') === 'dark';
    const accent = store.accent_color || '#63d2ff';
    const bg = store.bg_color || (isDark ? '#1a1a1a' : '#f6f5f2');
    const surface = store.surface_color || (isDark ? '#252525' : '#ffffff');
    const text = store.text_color || (isDark ? '#eef2f7' : '#1c1c1c');

    const vars = {
      '--bg': bg,
      '--bg-deep': shade(bg, isDark ? -0.18 : 0.4),
      '--bg-deeper': shade(bg, isDark ? -0.32 : 0.6),
      '--surface': rgba(surface, isDark ? 0.92 : 0.97),
      '--surface-hi': rgba(shade(surface, isDark ? 0.08 : -0.04), 0.95),
      '--glass': isDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)',
      '--border': rgba(accent, 0.14),
      '--border-hi': rgba(accent, 0.4),
      '--accent': accent,
      '--accent-soft': rgba(accent, 0.13),
      '--accent-glow': rgba(accent, 0.28),
      '--green': '#34d399',
      '--red': '#f87171',
      '--amber': '#fbbf24',
      '--text': text,
      '--text-2': mix(text, bg, 0.42),
      '--text-3': mix(text, bg, 0.66),
      '--font-display': `'${store.font_display || 'Outfit'}', sans-serif`,
      '--font-mono': `'${store.font_mono || 'DM Mono'}', monospace`
    };

    const root = document.documentElement.style;
    Object.entries(vars).forEach(([k, v]) => root.setProperty(k, v));

    loadGoogleFont(store.font_display || 'Outfit');
    loadGoogleFont(store.font_mono || 'DM Mono');

    if (store.name) document.title = store.name;
    if (store.favicon_url) {
      let icon = document.querySelector('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement('link');
        icon.rel = 'icon';
        document.head.appendChild(icon);
      }
      icon.href = store.favicon_url;
    }
  };
})();
