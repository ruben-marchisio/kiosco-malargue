/* =============================================
   Módulo home — Pantalla inicial: banners + grilla de COMERCIOS
   V2: Marketplace multi-comercio (antes: grilla de categorías)
   Máx. 300 líneas · Regla del proyecto
   ============================================= */

import {
  loadStores,
  selectStore,
  clearStore,
  RUBRO_EMOJI,
  motivoLabel,
  motivoIcon,
} from './stores.js';
import { state, saveCart } from './state.js';
import { updateBadge } from './cart.js';

// ── DOM refs ──────────────────────────────────
const homeView = document.getElementById('home-view');
const productsView = document.getElementById('products-view');

// ── API pública: vistas ───────────────────────
export function showHomeView() {
  homeView.style.display = 'block';
  productsView.style.display = 'none';
  document.getElementById('nav-home')?.classList.add('active');
  document.getElementById('nav-search')?.classList.remove('active');
  document.getElementById('nav-cart')?.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function showProductsView() {
  homeView.style.display = 'none';
  productsView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Banners ───────────────────────────────────
const DEFAULT_BANNERS = [
  {
    id: 'bienvenida',
    title: '¡Pedí desde casa! 🛍️',
    subtitle: 'Elegí tu local favorito y recibilo en tu puerta 🚴',
    emoji: '🏪',
    bgFrom: '#FF6B35',
    bgTo: '#ff9a6c',
    badge: null,
    action: null,
  },
  {
    id: 'novedad',
    title: '¡Nuevos comercios sumados!',
    subtitle: 'Verdulería, pizzería y más te esperan',
    emoji: '🎉',
    bgFrom: '#7c3aed',
    bgTo: '#a855f7',
    badge: 'Nuevo',
    action: null,
  },
];

let currentBannerIdx = 0;
let bannerTimer = null;
let bannerCount = 0;

function renderBanners(banners) {
  const wrap = document.getElementById('banners-wrap');
  if (!wrap) return;
  bannerCount = banners.length;

  wrap.innerHTML = `
    <div class="banner-track" id="banner-track">
      ${banners
        .map(
          (b, i) => `
        <div class="banner-card ${i === 0 ? 'active' : ''}"
             style="--bg-from:${b.bgFrom};--bg-to:${b.bgTo};"
             role="${b.action ? 'button' : 'img'}"
             aria-label="${b.title}">
          <div class="banner-content">
            ${b.badge ? `<span class="banner-badge">${b.badge}</span>` : ''}
            <p class="banner-title">${b.title}</p>
            <p class="banner-subtitle">${b.subtitle}</p>
          </div>
          <div class="banner-emoji-wrap" aria-hidden="true">${b.emoji}</div>
        </div>
      `
        )
        .join('')}
    </div>
    ${
      banners.length > 1
        ? `
      <div class="banner-dots" role="tablist" aria-label="Banners">
        ${banners
          .map(
            (_, i) => `
          <button class="banner-dot ${i === 0 ? 'active' : ''}"
                  data-idx="${i}" role="tab"
                  aria-label="Banner ${i + 1}"
                  aria-selected="${i === 0}">
          </button>
        `
          )
          .join('')}
      </div>
    `
        : ''
    }
  `;

  wrap
    .querySelectorAll('.banner-dot')
    .forEach((dot) =>
      dot.addEventListener('click', () => goToBanner(parseInt(dot.dataset.idx, 10)))
    );
  if (banners.length > 1) startBannerRotation();
}

function goToBanner(idx) {
  document
    .querySelectorAll('.banner-card')
    .forEach((c, i) => c.classList.toggle('active', i === idx));
  document.querySelectorAll('.banner-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
    d.setAttribute('aria-selected', String(i === idx));
  });
  currentBannerIdx = idx;
}

function startBannerRotation() {
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => goToBanner((currentBannerIdx + 1) % bannerCount), 5000);
}

// ── Render grilla de COMERCIOS ────────────────
function storeCard(comercio) {
  const emoji = RUBRO_EMOJI[comercio.rubro] || '🏪';
  const abierto = comercio.abierto !== false; // default true si el campo no existe
  const cerrado = !abierto;

  const colorVar = comercio.color_primario || '#FF6B35';
  // Para el ícono de estado
  const statusBadge = abierto
    ? `<span class="store-badge store-badge-open">🟢 Abierto</span>`
    : `<span class="store-badge store-badge-closed">🔴 Cerrado</span>`;

  const metaItems = [
    comercio.horario_texto
      ? `<span class="store-meta-item">🕒 ${comercio.horario_texto}</span>`
      : '',
    comercio.tiempo_entrega
      ? `<span class="store-meta-item">🚴 ${comercio.tiempo_entrega}</span>`
      : '',
    comercio.pedido_minimo
      ? `<span class="store-meta-item">💵 Mín. $${comercio.pedido_minimo}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  return `
    <button class="store-card ${cerrado ? 'store-card-closed' : ''}"
            data-store-id="${comercio.id}"
            style="--store-color: ${colorVar}"
            aria-label="${comercio.nombre}${cerrado ? ' — Cerrado' : ''}"
            ${cerrado ? 'aria-disabled="true"' : ''}>
      <div class="store-card-top">
        <div class="store-logo">
          ${
            comercio.logo_url
              ? `<img src="${comercio.logo_url}" alt="${comercio.nombre}" class="store-logo-img">`
              : `<span class="store-logo-emoji" aria-hidden="true">${emoji}</span>`
          }
          ${cerrado ? `<div class="store-closed-overlay"><span>${motivoIcon(comercio.motivo_cierre)}</span></div>` : ''}
        </div>
        <div class="store-info">
          <div class="store-name">${comercio.nombre}</div>
          ${comercio.descripcion ? `<div class="store-desc">${comercio.descripcion}</div>` : ''}
          ${statusBadge}
        </div>
      </div>
      ${metaItems ? `<div class="store-meta">${metaItems}</div>` : ''}
      ${
        cerrado && comercio.hora_reapertura
          ? `<div class="store-reopen-hint">Reabre a las ${comercio.hora_reapertura}</div>`
          : ''
      }
    </button>
  `;
}

function renderStoreGrid(stores) {
  const grid = document.getElementById('home-stores-grid');
  if (!grid) return;

  if (!stores.length) {
    grid.innerHTML = `
      <div class="stores-empty">
        <div class="emoji">🏪</div>
        <p>No hay comercios disponibles por el momento</p>
      </div>`;
    return;
  }

  grid.innerHTML = stores.map(storeCard).join('');

  // Eventos de click — solo en comercios ABIERTOS
  grid.querySelectorAll('.store-card:not(.store-card-closed)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const store = stores.find((s) => s.id === btn.dataset.storeId);
      if (!store) return;
      handleStoreSelect(store);
    });
  });

  // Click en cerrados → toast informativo
  grid.querySelectorAll('.store-card-closed').forEach((btn) => {
    btn.addEventListener('click', () => {
      const store = stores.find((s) => s.id === btn.dataset.storeId);
      if (!store) return;
      const msg = store.mensaje_cierre || motivoLabel(store.motivo_cierre);
      const reapertura = store.hora_reapertura ? ` Reabre a las ${store.hora_reapertura}.` : '';
      // Usar el toast del sistema
      document.dispatchEvent(
        new CustomEvent('kiosco:toast', {
          detail: `🔴 ${store.nombre} está cerrado. ${msg}${reapertura}`,
        })
      );
    });
  });
}

function handleStoreSelect(store) {
  if (state.cart.length > 0) {
    if (state.cartStoreId && state.cartStoreId !== store.id) {
      const doClear = confirm(
        `Tienes productos de otro local en tu carrito.\n\n¿Deseas vaciar el carrito para comprar en ${store.nombre}?`
      );
      if (doClear) {
        state.cart = [];
        state.cartStoreId = store.id;
        saveCart();
        updateBadge();
      } else {
        return; // Detener navegación si el usuario cancela
      }
    } else if (!state.cartStoreId) {
      // Carrito con items pero sin store_id (legacy)
      state.cartStoreId = store.id;
      saveCart();
    }
  } else {
    // Carrito vacío, simplemente actualizamos el store_id al nuevo local
    state.cartStoreId = store.id;
    saveCart();
  }

  selectStore(store);
  // products.js escucha el evento 'kiosco:storeSelected' y carga los productos
  showProductsView();
}

// ── Sección de locales: skeleton mientras carga ──
function renderStoreSkeletons() {
  const grid = document.getElementById('home-stores-grid');
  if (!grid) return;
  grid.innerHTML = Array(4)
    .fill(0)
    .map(
      () => `
    <div class="store-card store-card-skeleton" aria-hidden="true">
      <div class="store-card-top">
        <div class="store-logo skeleton-box"></div>
        <div class="store-info">
          <div class="skeleton-line skeleton-line-lg"></div>
          <div class="skeleton-line skeleton-line-sm"></div>
          <div class="skeleton-line skeleton-line-xs"></div>
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

// ── Inicialización pública ────────────────────
export async function initHomeView() {
  clearStore();
  renderBanners(DEFAULT_BANNERS);
  renderStoreSkeletons();
  showHomeView();

  const stores = await loadStores();
  renderStoreGrid(stores);
}
