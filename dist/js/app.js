/* =============================================
   El Pechito — Punto de entrada principal
   Importa módulos y conecta eventos globales.
   ============================================= */

import './theme.js';
import { addToCart, changeQty, openCart, closeCart, updateBadge } from './cart.js';
import { closeCheckout } from './checkout.js';
import { openSearch, closeSearch } from './search.js';
import { loadProducts, initCategories } from './products.js';
import { initHomeView, showHomeView } from './home.js';

// ── Eventos CustomEvent (products → cart) ─────
// products.js dispara estos eventos para evitar imports circulares
document.addEventListener('kiosco:addToCart', (e) => addToCart(e.detail));
document.addEventListener('kiosco:changeQty', (e) => changeQty(e.detail.id, e.detail.delta));

// ── Bottom Nav ────────────────────────────────
const overlay = document.getElementById('overlay');

document.getElementById('nav-home').addEventListener('click', () => {
  closeCart();
  closeSearch();
  showHomeView();
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
document.getElementById('back-to-home').addEventListener('click', () => {
  closeCart();
  closeSearch();
  showHomeView();
});
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

// ── Compartir la app ──────────────────────────
document.getElementById('share-btn').addEventListener('click', async () => {
  const shareData = {
    title: 'El Pechito — Pedidos a domicilio · Malargüe',
    text: '🛍️ ¡Pedí en El Pechito desde el celu! Sin registro, sin app. Te lo traen a domicilio 🚴',
    url: 'https://kiosco-malargue.rubenmarchisio-4e3.workers.dev/',
  };

  if (navigator.share) {
    // Menú nativo del celular (Android/iOS)
    try {
      await navigator.share(shareData);
    } catch (e) {
      // El usuario canceló — no hacer nada
      if (e.name !== 'AbortError') console.error(e);
    }
  } else {
    // Fallback para desktop: copiar URL al portapapeles
    try {
      await navigator.clipboard.writeText(shareData.url);
      showToast('🔗 Link copiado al portapapeles');
    } catch {
      showToast('📋 Copiá este link: ' + shareData.url);
    }
  }
});

// ── Inicialización ────────────────────────────
initCategories();
updateBadge();
loadProducts(); // carga en background — la home no espera esto
initHomeView(); // muestra la pantalla de inicio

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
