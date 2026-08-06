/* =============================================
   Kiosco Digital — Punto de entrada principal
   Importa módulos y conecta eventos globales.
   ============================================= */

import './theme.js';
import { addToCart, changeQty, openCart, closeCart, updateBadge } from './cart.js';
import { closeCheckout } from './checkout.js';
import { openSearch, closeSearch } from './search.js';
import { loadProducts, initCategories } from './products.js';

// ── Eventos CustomEvent (products → cart) ─────
// products.js dispara estos eventos para evitar imports circulares
document.addEventListener('kiosco:addToCart', (e) => addToCart(e.detail));
document.addEventListener('kiosco:changeQty', (e) => changeQty(e.detail.id, e.detail.delta));

// ── Bottom Nav ────────────────────────────────
const overlay = document.getElementById('overlay');

document.getElementById('nav-home').addEventListener('click', () => {
  closeCart();
  closeSearch();
});
document.getElementById('nav-search').addEventListener('click', () => {
  closeCart();
  openSearch();
});
document.getElementById('nav-cart').addEventListener('click', () => {
  closeSearch();
  openCart();
});

// ── Otros triggers ────────────────────────────
document.getElementById('search-bar-trigger').addEventListener('click', openSearch);
document.getElementById('search-cancel').addEventListener('click', closeSearch);
document.getElementById('close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', () => {
  closeCart();
  closeSearch();
  closeCheckout();
});

// ── Install Prompt (PWA) ──────────────────────
import { state } from './state.js';
import { showToast } from './utils.js';

const installBanner = document.getElementById('install-banner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredInstallPrompt = e;
  if (!sessionStorage.getItem('install_dismissed')) installBanner.classList.add('show');
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  const { outcome } = await state.deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    installBanner.classList.remove('show');
    showToast('🎉 ¡App instalada! Buscala en tu pantalla de inicio');
  }
  state.deferredInstallPrompt = null;
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  installBanner.classList.remove('show');
  sessionStorage.setItem('install_dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  state.deferredInstallPrompt = null;
});

// ── Inicialización ────────────────────────────
initCategories();
updateBadge();
loadProducts();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
