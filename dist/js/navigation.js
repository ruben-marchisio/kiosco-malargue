/* =============================================
   Módulo de navegación — History API
   Intercepta el botón físico "Atrás" del celular
   para navegar dentro de la app sin salir de ella.

   Jerarquía de vistas:
   home → cat-landing → products-grid-view
   (+ overlays: cart-sheet, checkout-sheet, cadeteria, map, search, perfil)

   CLAVE: separamos dos conceptos:
   - navGoTo()  → el usuario navegó HACIA adelante   → pushState
   - navGoBack()→ el usuario cerró algo con la UI    → history.back() para sincronizar
   - handleBack → intercepta el botón físico         → cierra la vista activa
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
  PERFIL: 'perfil',
  CAT_LANDING: 'cat',
  PRODUCTS: 'products',
  CADETERIA: 'cadeteria',
  CART: 'cart',
  CHECKOUT: 'checkout',
  MAP: 'map',
  SEARCH: 'search',
};

// ── Estado actual de la app ───────────────────
// Rastreamos qué pantalla está abierta AHORA para saber qué cerrar al presionar atrás.
let _currentNav = NAV.HOME;

// ── Helpers internos ──────────────────────────
function pushNav(navState) {
  _currentNav = navState;
  history.pushState({ nav: navState }, '', location.pathname);
}

function replaceNav(navState) {
  _currentNav = navState;
  history.replaceState({ nav: navState }, '', location.pathname);
}

// ── API pública — ir HACIA ADELANTE ──────────
// Llamar cuando el usuario abre una nueva sección
export function navToHome() {
  replaceNav(NAV.HOME);
}
export function navOpenPerfil() {
  pushNav(NAV.PERFIL);
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

// ── API pública — cerrar desde la UI de la app ─
// Cuando el usuario cierra algo usando los botones de la interfaz (✕, overlay, etc.)
// hay que consumir el estado del historial para mantenerlo sincronizado.
// Esto hace que el botón de atrás NO duplique el cierre.
export function navPopOnClose() {
  if (_currentNav !== NAV.HOME) {
    _currentNav = NAV.HOME; // temporal: handleBack actualizará correctamente
    history.back();
  }
}

// ── Lógica de retroceso ───────────────────────
// Se dispara cuando el usuario presiona el botón físico de atrás del teléfono.
// "closingState" = lo que estaba abierto antes → lo que hay que cerrar.
let _handling = false; // evitar doble disparo

function handleBack(event) {
  if (_handling) return;

  const closingState = _currentNav;
  // Actualizamos a dónde llegó el navegador
  _currentNav = event.state?.nav ?? NAV.HOME;

  _handling = true;

  switch (closingState) {
    case NAV.HOME:
      // Estamos en el home → no hay nada que cerrar dentro de la app.
      _handling = false;
      return;

    case NAV.PERFIL:
      // Perfil abierto → ocultarlo y volver al home
      document.getElementById('perfil-view').style.display = 'none';
      document.getElementById('home-view').style.display = 'block';
      document.getElementById('nav-home')?.classList.add('active');
      document.getElementById('nav-perfil')?.classList.remove('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
      break;

    case NAV.CAT_LANDING:
      // Landing de categorías → volver al home (lista de locales)
      closeCart();
      closeSearch();
      document.getElementById('perfil-view').style.display = 'none';
      document.getElementById('cadeteria-view').style.display = 'none';
      showHomeView();
      break;

    case NAV.PRODUCTS:
      // Grilla de productos → volver a categorías
      showCategoryLanding();
      break;

    case NAV.CADETERIA:
      // Cadetería → volver al home
      document.getElementById('cadeteria-view').style.display = 'none';
      showHomeView();
      break;

    case NAV.CART:
      // Carrito abierto → cerrarlo (sin tocar el historial, ya retrocedimos)
      closeCart();
      break;

    case NAV.CHECKOUT:
      // Checkout abierto → cerrarlo
      closeCheckout();
      break;

    case NAV.MAP: {
      // Mapa de locales → cerrarlo
      const mapSheet = document.getElementById('locales-map-sheet');
      const mapOverlay = document.getElementById('locales-map-overlay');
      if (mapSheet) mapSheet.classList.remove('open');
      if (mapOverlay) mapOverlay.style.display = 'none';
      document.body.style.overflow = '';
      break;
    }

    case NAV.SEARCH:
      // Buscador → cerrarlo
      closeSearch();
      break;

    default:
      break;
  }

  _handling = false;
}

// ── Inicialización ────────────────────────────
export function initNavigation() {
  replaceNav(NAV.HOME);
  window.addEventListener('popstate', handleBack);
}
