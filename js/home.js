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
import { getUserLocation } from './perfil.js';
import { calculateDistance } from './checkout.js';

/* global L */

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
function distanceBadge(comercio) {
  const loc = getUserLocation();
  if (!loc || !comercio.coords_lat || !comercio.coords_lng) return '';
  const dist = calculateDistance(loc.lat, loc.lng, comercio.coords_lat, comercio.coords_lng);
  const label = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
  return `<span class="store-meta-item" style="color: var(--primary); font-weight: 700">📍 ${label}</span>`;
}

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
    distanceBadge(comercio),
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

  // Re-renderizar tarjetas cuando el usuario guarda/borra su ubicación
  document.addEventListener('kiosco:locationSaved', () => {
    renderStoreGrid(stores);
  });

  // Mapa de locales
  initLocalesMapButton(stores);
}

// ── MAPA DE LOCALES (Radar) ───────────────────
let localesMapInstance = null;

function initLocalesMapButton(stores) {
  const btnVerMapa = document.getElementById('btn-ver-mapa');
  const mapSheet = document.getElementById('locales-map-sheet');
  const overlay = document.getElementById('locales-map-overlay');
  const btnClose = document.getElementById('close-locales-map');

  function openMap() {
    if (!mapSheet) return;
    mapSheet.classList.add('open');
    if (overlay) overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => buildLocalesMap(stores), 300);
  }

  function closeMap() {
    mapSheet?.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  btnVerMapa?.addEventListener('click', openMap);
  btnClose?.addEventListener('click', closeMap);
  overlay?.addEventListener('click', closeMap);
}

function buildLocalesMap(stores) {
  if (localesMapInstance) {
    localesMapInstance.invalidateSize();
    return;
  }

  // Centro por defecto: Malargüe
  localesMapInstance = L.map('locales-map').setView([-35.495, -69.584], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
  }).addTo(localesMapInstance);

  const bounds = [];

  // Marcadores de locales
  stores.forEach((s) => {
    if (!s.coords_lat || !s.coords_lng) return;
    const abierto = s.abierto !== false;
    const color = abierto ? '#22c55e' : '#ef4444';
    const emoji = abierto ? '🟢' : '🔴';

    const icon = L.divIcon({
      html: `<div style="
        background: ${color};
        color: #fff;
        border-radius: 50%;
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        border: 3px solid #fff;
      ">${emoji}</div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker([s.coords_lat, s.coords_lng], { icon }).addTo(localesMapInstance);
    bounds.push([s.coords_lat, s.coords_lng]);

    const popupContent = `
      <div style="font-family: inherit; min-width: 150px">
        <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px">${s.nombre}</div>
        <div style="font-size: 12px; color: ${color}; margin-bottom: ${abierto ? '10px' : '0'}">${abierto ? '🟢 Abierto' : '🔴 Cerrado'}</div>
        ${
          abierto
            ? `<button
            onclick="document.getElementById('locales-map-sheet').classList.remove('open');
                     document.getElementById('locales-map-overlay').style.display='none';
                     document.body.style.overflow='';
                     document.dispatchEvent(new CustomEvent('kiosco:openStore',{detail:'${s.id}'}));"
            style="width:100%;padding:8px;background:#FF6B35;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px"
          >Ver productos →</button>`
            : ''
        }
      </div>`;

    marker.bindPopup(popupContent, { maxWidth: 210, offset: [0, -12] });
  });

  // Marcador del usuario
  const loc = getUserLocation();
  if (loc) {
    const userIcon = L.divIcon({
      html: `<div style="
        background: #3b82f6;
        color: #fff;
        border-radius: 50%;
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        box-shadow: 0 2px 10px rgba(59,130,246,0.5);
        border: 3px solid #fff;
      ">📍</div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    L.marker([loc.lat, loc.lng], { icon: userIcon })
      .addTo(localesMapInstance)
      .bindPopup(
        `<strong>Vos estás aquí</strong><br><span style="font-size:12px;color:#666">${loc.label}</span>`
      );
    bounds.push([loc.lat, loc.lng]);
  }

  // Ajustar zoom para que entren todos
  if (bounds.length > 1) {
    localesMapInstance.fitBounds(bounds, { padding: [48, 48] });
  } else if (bounds.length === 1) {
    localesMapInstance.setView(bounds[0], 15);
  }

  // Navegar al local desde el popup
  document.addEventListener('kiosco:openStore', (e) => {
    const store = stores.find((s) => s.id === e.detail);
    if (store && store.abierto !== false) handleStoreSelect(store);
  });
}
