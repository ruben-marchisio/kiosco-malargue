/* =============================================
   Módulo de búsqueda — overlay y filtrado
   ============================================= */

import { state } from './state.js';
import { setNavActive } from './utils.js';
import { productCard, bindProductEvents } from './products.js';

// ── DOM refs ──────────────────────────────────
const searchOverlay = document.getElementById('search-overlay');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

const HINT_HTML = `<div class="search-hint"><div class="emoji">🔍</div><p>Escribí para buscar productos</p></div>`;

// ── Open / Close ──────────────────────────────
export function openSearch() {
  searchOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => searchInput.focus(), 300);
  setNavActive('search');
}

export function closeSearch() {
  searchOverlay.classList.remove('open');
  document.body.style.overflow = '';
  searchInput.value = '';
  searchResults.innerHTML = HINT_HTML;
  setNavActive('home');
}

// ── Búsqueda en tiempo real ───────────────────
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    searchResults.innerHTML = HINT_HTML;
    return;
  }
  const results = state.allProducts.filter(
    (p) => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
  );
  if (!results.length) {
    searchResults.innerHTML = `<div class="search-hint"><div class="emoji">😕</div><p>Sin resultados para "<strong>${q}</strong>"</p></div>`;
    return;
  }
  searchResults.innerHTML = `<div class="products-grid">${results.map((p) => productCard(p)).join('')}</div>`;
  bindProductEvents(searchResults);
});
