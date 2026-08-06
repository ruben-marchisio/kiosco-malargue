/* =============================================
   Tema claro / oscuro
   Se auto-ejecuta al importarse; no exporta nada.
   ============================================= */

const htmlEl = document.documentElement;
const btn = document.getElementById('theme-toggle');

function applyTheme(dark) {
  htmlEl.setAttribute('data-theme', dark ? 'dark' : 'light');
  btn.textContent = dark ? '☀️' : '🌙';
  btn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

// Aplicar preferencia guardada o del sistema operativo
const saved = localStorage.getItem('kiosco_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(saved ? saved === 'dark' : prefersDark);

btn.addEventListener('click', () => {
  const isDark = htmlEl.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  localStorage.setItem('kiosco_theme', !isDark ? 'dark' : 'light');
});
