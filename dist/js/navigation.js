/* =============================================
   Módulo de navegación — History API
   Intercepta el botón físico "Atrás" del celular
   para navegar dentro de la app sin salir de ella.

   Jerarquía de vistas:
   home → cat-landing → products-grid-view
   (+ overlays: cart-sheet, checkout-sheet, cadeteria, map)
   ============================================= */
/* global history, location */

import { closeCart } from './cart.js';
import { closeCheckout } from './checkout.js';
import { closeSearch } from './search.js';
import { showHomeView } from './home.js';
import { showCategoryLanding } from './products.js';

// ── Identificadores de estado ─────────────────
export const NAV = {
  HOME: 'home',
  CAT_LANDING: 'cat',
  PRODUCTS: 'products',
  CADETERIA: 'cadeteria',
  CART: 'cart',
  CHECKOUT: 'checkout',
  MAP: 'map',
  SEARCH: 'search',
};

// ── Helpers internos ──────────────────────────
function pushNav(navState) {
  history.pushState({ nav: navState }, '', location.pathname);
}

function replaceNav(navState) {
  history.replaceState({ nav: navState }, '', location.pathname);
}

// ── API pública ───────────────────────────────
export function navToHome() {
  replaceNav(NAV.HOME);
}
export function navToCatLanding() {
  pushNav(NAV.CAT_LANDING);
}
export function navToProducts() {
  pushNav(NAV.PRODUCTS);
}
export function navToCadeteria() {
  pushNav(NAV.CADETERIA);
}
export function navOpenCart() {
  pushNav(NAV.CART);
}
export function navOpenCheckout() {
  pushNav(NAV.CHECKOUT);
}
export function navOpenSearch() {
  pushNav(NAV.SEARCH);
}
export function navOpenMap() {
  pushNav(NAV.MAP);
}

// ── Lógica de retroceso ───────────────────────
function handleBack(event) {
  const navState = event.state?.nav ?? NAV.HOME;

  switch (navState) {
    case NAV.HOME:
      // No hay nada más atrás dentro de la app; dejar que el navegador actúe.
      return;

    case NAV.CAT_LANDING:
      closeCart();
      closeSearch();
      document.getElementById('perfil-view').style.display = 'none';
      document.getElementById('cadeteria-view').style.display = 'none';
      showHomeView();
      break;

    case NAV.PRODUCTS:
      showCategoryLanding();
      break;

    case NAV.CADETERIA:
      document.getElementById('cadeteria-view').style.display = 'none';
      showHomeView();
      break;

    case NAV.CART:
      closeCart();
      break;

    case NAV.CHECKOUT:
      closeCheckout();
      break;

    case NAV.MAP: {
      const mapSheet = document.getElementById('locales-map-sheet');
      const mapOverlay = document.getElementById('locales-map-overlay');
      if (mapSheet) mapSheet.classList.remove('open');
      if (mapOverlay) mapOverlay.style.display = 'none';
      document.body.style.overflow = '';
      break;
    }

    case NAV.SEARCH:
      closeSearch();
      break;

    default:
      break;
  }
}

// ── Inicialización ────────────────────────────
export function initNavigation() {
  replaceNav(NAV.HOME);
  window.addEventListener('popstate', handleBack);
}
