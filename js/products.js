/* =============================================
   Módulo de productos — catálogo, render, categorías
   Multi-comercio: filtra por store seleccionado
   ============================================= */
/* global ENVIO_CONFIG */

import { supabase } from './api.js';
import { state } from './state.js';
import { fmt, skeletons, showToast } from './utils.js';
import { getCachedCatalog, setCatalogCache } from './cache.js';
import { initFromConfig } from './store-status.js';
import { selectedStore, RUBRO_EMOJI } from './stores.js';
import { getUserLocation } from './perfil.js';
import { calculateDistance } from './checkout.js';
import { navToProducts } from './navigation.js';

// ── Constantes ────────────────────────────────
// ⚠️ Estas categorías deben mantenerse sincronizadas con VALID_CATS en admin/js/stock.js
export const CATS = [
  { id: 'todo', label: 'Todo', emoji: '🛍️' },
  { id: 'combos', label: 'Combos', emoji: '🔥', featured: true },
  { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { id: 'alcohol', label: 'Con alcohol', emoji: '🍺' },
  { id: 'snacks', label: 'Snacks', emoji: '🍫' },
  { id: 'comidas', label: 'Comidas', emoji: '🍽️' },
  { id: 'panaderia', label: 'Panadería', emoji: '🥐' },
  { id: 'almacen', label: 'Almacén', emoji: '🏪' },
  { id: 'verduleria', label: 'Verdulería', emoji: '🥦' },
  { id: 'limpieza', label: 'Limpieza', emoji: '🧹' },
  { id: 'higiene', label: 'Higiene', emoji: '🧴' },
  { id: 'cigarrillos', label: 'Cigarrillos', emoji: '🚬' },
  { id: 'mascota', label: 'Mascotas', emoji: '🐾' },
  { id: 'libreria', label: 'Librería', emoji: '✏️' },
  { id: 'otros', label: 'Otros', emoji: '📦' },
];

export const CAT_EMOJI = {
  combos: '🔥',
  bebidas: '🥤',
  alcohol: '🍺',
  snacks: '🍫',
  comidas: '🍽️',
  panaderia: '🥐',
  almacen: '🏪',
  verduleria: '🥦',
  limpieza: '🧹',
  higiene: '🧴',
  cigarrillos: '🚬',
  mascota: '🐾',
  libreria: '✏️',
  otros: '📦',
};

// ── DOM refs ──────────────────────────────────
const gridEl = document.getElementById('products-grid');
const catScroll = document.getElementById('cat-scroll');
const sectionTitle = document.getElementById('section-title');
const catLanding = document.getElementById('cat-landing');
const catLandingGrid = document.getElementById('cat-landing-grid');
const productsGridView = document.getElementById('products-grid-view');

// ── Colores de fondo por categoría ────────────
const CAT_COLORS = {
  todo: { bg: 'linear-gradient(135deg, #ff6b35 0%, #e8521a 100%)', text: '#fff' },
  combos: { bg: 'linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)', text: '#fff' },
  bebidas: { bg: 'linear-gradient(135deg, #3b9eff 0%, #1a6fcc 100%)', text: '#fff' },
  alcohol: { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#fff' },
  snacks: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: '#fff' },
  comidas: { bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', text: '#fff' },
  panaderia: { bg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)', text: '#fff' },
  almacen: { bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', text: '#fff' },
  verduleria: { bg: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', text: '#fff' },
  limpieza: { bg: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)', text: '#fff' },
  higiene: { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', text: '#fff' },
  cigarrillos: { bg: 'linear-gradient(135deg, #6b7280 0%, #374151 100%)', text: '#fff' },
  mascota: { bg: 'linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)', text: '#fff' },
  libreria: { bg: 'linear-gradient(135deg, #f43f5e 0%, #9f1239 100%)', text: '#fff' },
  otros: { bg: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)', text: '#fff' },
};

// ── Categorías ────────────────────────────────
export function initCategories() {
  CATS.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === 'todo' ? ' active' : '');
    btn.dataset.cat = cat.id;
    btn.innerHTML = `<span>${cat.emoji}</span> ${cat.label}`;
    btn.addEventListener('click', () => selectCategory(cat.id, `${cat.emoji} ${cat.label}`));
    catScroll.appendChild(btn);
  });
}

export function selectCategory(id, label) {
  state.currentCat = id;
  document
    .querySelectorAll('.cat-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.cat === id));
  sectionTitle.textContent = id === 'todo' ? '🛍️ Todos los productos' : label;

  // Ocultar landing y mostrar grilla
  if (catLanding) catLanding.style.display = 'none';
  if (productsGridView) productsGridView.style.display = 'block';

  navToProducts(); // registrar en el historial
  renderProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Volver a pantalla de categorías ────────────
export function showCategoryLanding() {
  if (productsGridView) productsGridView.style.display = 'none';
  if (catLanding) {
    catLanding.style.display = 'block';
    // Resetear la animación
    catLanding.classList.remove('cat-landing-visible');
    void catLanding.offsetWidth; // reflow
    catLanding.classList.add('cat-landing-visible');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Listener del botón "← Categorías"
document.getElementById('back-to-cats')?.addEventListener('click', showCategoryLanding);

// ── Carga ──────────────────────────────
function updateEnvioBanner() {
  const banner = document.getElementById('envio-banner');
  const bannerText = document.getElementById('envio-banner-text');
  if (!banner || !bannerText) return;

  const loc = getUserLocation();
  const store = selectedStore;

  if (!loc) {
    // Sin ubicación guardada
    banner.style.display = 'block';
    bannerText.innerHTML =
      '📍 <span style="color:var(--text-muted)">Guardá tu ubicación en Mi Perfil para ver el costo de envío</span>';
    banner.onclick = () => document.getElementById('nav-perfil')?.click();
    return;
  }

  if (store?.coords_lat && store?.coords_lng) {
    const dist = calculateDistance(loc.lat, loc.lng, store.coords_lat, store.coords_lng);
    // Cálculo rápido del costo (misma lógica que checkout)
    const cfg =
      typeof ENVIO_CONFIG !== 'undefined'
        ? ENVIO_CONFIG
        : { base: 1500, distanciaBase: 1.5, extraPorKm: 500, maximo: 4000 };
    let costo = cfg.base;
    if (dist > cfg.distanciaBase) costo += (dist - cfg.distanciaBase) * cfg.extraPorKm;
    if (costo > cfg.maximo) costo = cfg.maximo;
    costo = Math.round(costo / 100) * 100;
    const distLabel = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
    banner.style.display = 'block';
    bannerText.innerHTML = `🛵 Envío estimado: <strong>$${fmt(costo)}</strong> <span style="color:var(--text-muted)">~${distLabel} de distancia</span>`;
    banner.onclick = null;
  } else {
    banner.style.display = 'none';
  }
}

// Actualizar el banner cuando cambia la ubicación del usuario
document.addEventListener('kiosco:locationSaved', updateEnvioBanner);

export async function loadProducts() {
  gridEl.innerHTML = skeletons(6);
  updateEnvioBanner();

  // Si hay un comercio seleccionado → cargar SUS productos directamente
  if (selectedStore) {
    await loadProductsForStore(selectedStore.id);
    return;
  }

  // Sin comercio seleccionado → flujo original (config_negocio + caché)
  const { data: cfg, error: cfgError } = await supabase
    .from('config_negocio')
    .select('updated_at, stock_version, abierto, motivo_cierre, mensaje_cierre, hora_reapertura')
    .eq('id', 1)
    .single();

  initFromConfig(cfg, cfg?.updated_at ?? null);

  const remoteVersion = cfg?.updated_at ?? null;

  if (!cfgError && remoteVersion) {
    const cached = getCachedCatalog();
    if (cached && cached.version === remoteVersion) {
      state.allProducts = cached.products;
      renderProducts();
      return;
    }
  }

  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria')
    .order('nombre');

  if (error) {
    const cached = getCachedCatalog();
    if (cached) {
      state.allProducts = cached.products;
      renderProducts();
      showToast('⚠️ Sin conexión — mostrando catálogo guardado');
      return;
    }
    gridEl.innerHTML = `<p style="color:red;padding:20px;grid-column:1/-1">Error al cargar productos. Verificá tu conexión.</p>`;
    return;
  }

  if (remoteVersion) setCatalogCache(data, remoteVersion);
  state.allProducts = data;
  renderProducts();
}

// ── Carga de productos de un comercio específico ──────────────
async function loadProductsForStore(comercioId) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('comercio_id', comercioId)
    .order('categoria')
    .order('nombre');

  if (error) {
    gridEl.innerHTML = `<p style="color:red;padding:20px;grid-column:1/-1">Error al cargar productos. Verificá tu conexión.</p>`;
    return;
  }

  state.allProducts = data || [];
  // Actualizar las categorías visibles según los productos del comercio
  updateCategoriesForStore(state.allProducts);
  // Mostrar el header con info del comercio
  updateStoreHeader(selectedStore);
  // Mostrar la pantalla de categorías como paso inicial
  showCategorySelection(state.allProducts);
}

// ── Pantalla de selección de categorías ────────────────────────
export function showCategorySelection(products) {
  if (!catLandingGrid || !catLanding) {
    renderProducts();
    return;
  }

  // Contar productos por categoría
  const counts = {};
  (products || state.allProducts).forEach((p) => {
    if (!counts[p.categoria]) counts[p.categoria] = 0;
    counts[p.categoria]++;
  });

  // Filtrar categorías que tienen productos
  const presentCats = CATS.filter((c) => c.id === 'todo' || counts[c.id] > 0);
  const total = (products || state.allProducts).length;

  catLandingGrid.innerHTML = presentCats
    .map((cat) => {
      const count = cat.id === 'todo' ? total : counts[cat.id];
      const colors = CAT_COLORS[cat.id] || CAT_COLORS.otros;
      const isFeatured = cat.featured ? 'cat-card--featured' : '';
      return `
        <button
          class="cat-card ${isFeatured}"
          data-cat="${cat.id}"
          style="background: ${colors.bg}; color: ${colors.text};"
          aria-label="Ver ${cat.label}"
        >
          <span class="cat-card-emoji">${cat.emoji}</span>
          <span class="cat-card-label">${cat.label}</span>
          <span class="cat-card-count">${count} producto${count !== 1 ? 's' : ''}</span>
        </button>`;
    })
    .join('');

  // Eventos de click en tarjetas
  catLandingGrid.querySelectorAll('.cat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const catId = card.dataset.cat;
      const cat = CATS.find((c) => c.id === catId);
      if (cat) selectCategory(cat.id, `${cat.emoji} ${cat.label}`);
    });
  });

  // Ocultar grilla, mostrar landing con animación
  if (productsGridView) productsGridView.style.display = 'none';
  catLanding.style.display = 'block';
  catLanding.classList.remove('cat-landing-visible');
  void catLanding.offsetWidth; // reflow para animar
  catLanding.classList.add('cat-landing-visible');
}

// ── Actualizar categorías visibles para el comercio ───────────
function updateCategoriesForStore(products) {
  const catScroll = document.getElementById('cat-scroll');
  if (!catScroll) return;

  // Obtener categorías únicas presentes en los productos
  const presentCats = new Set(products.map((p) => p.categoria));

  // Siempre incluir 'todo' primero
  const catsToShow = CATS.filter((c) => c.id === 'todo' || presentCats.has(c.id));

  catScroll.innerHTML = '';
  catsToShow.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === 'todo' ? ' active' : '');
    btn.dataset.cat = cat.id;
    btn.innerHTML = `<span>${cat.emoji}</span> ${cat.label}`;
    btn.addEventListener('click', () => selectCategory(cat.id, `${cat.emoji} ${cat.label}`));
    catScroll.appendChild(btn);
  });

  // Reset a 'todo' al cambiar de comercio
  state.currentCat = 'todo';
  const sectionTitle = document.getElementById('section-title');
  if (sectionTitle) sectionTitle.textContent = '🛍️ Todos los productos';
}

// ── Actualizar header del comercio en vista productos ────────────
export function updateStoreHeader(comercio) {
  const header = document.getElementById('store-header');
  const logoEl = document.getElementById('store-header-logo');
  const nameEl = document.getElementById('store-header-name');
  const metaEl = document.getElementById('store-header-meta');
  const statusEl = document.getElementById('store-header-status');
  if (!header) return;

  if (!comercio) {
    header.style.display = 'none';
    return;
  }

  const emoji = RUBRO_EMOJI[comercio.rubro] || '🏪';
  const abierto = comercio.abierto !== false;

  logoEl.innerHTML = comercio.logo_url
    ? `<img src="${comercio.logo_url}" alt="${comercio.nombre}">`
    : emoji;
  nameEl.textContent = comercio.nombre;

  const metaParts = [];
  if (comercio.tiempo_entrega) metaParts.push(`🚴 ${comercio.tiempo_entrega}`);
  if (comercio.horario_texto) metaParts.push(comercio.horario_texto);
  metaEl.textContent = metaParts.join(' · ');

  statusEl.textContent = abierto ? '🟢 Abierto' : '🔴 Cerrado';
  statusEl.className = `store-header-status ${abierto ? 'open' : 'closed'}`;

  header.style.display = 'block';
}

// applyStoreStatus eliminado — store-status.js maneja el badge via initFromConfig()

// ── Render ────────────────────────────────────
export function renderProducts(list = null) {
  const source = list ?? state.allProducts;
  const filtered =
    list !== null
      ? source
      : state.currentCat === 'todo'
        ? source
        : source.filter((p) => p.categoria === state.currentCat);

  if (!filtered.length) {
    gridEl.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>No hay productos aquí</p></div>`;
    return;
  }
  gridEl.innerHTML = filtered.map((p) => productCard(p)).join('');
  bindProductEvents(gridEl);
}

export function productCard(p) {
  const inCart = state.cart.find((c) => c.id === p.id);
  const qty = inCart ? inCart.qty : 0;

  // El wrapper de imagen también suma al carrito
  const imgAction = !p.disponible ? '' : qty > 0 ? `data-inc="${p.id}"` : `data-add="${p.id}"`;

  const imgHtml = p.imagen_url
    ? `<img class="prod-img" src="${p.imagen_url}" alt="${p.nombre}" loading="lazy">`
    : `<div class="prod-placeholder">${CAT_EMOJI[p.categoria] || '📦'}</div>`;

  const actionHtml = !p.disponible
    ? `<button class="add-btn" disabled title="Sin stock">+</button>`
    : qty > 0
      ? `<div class="qty-ctrl">
           <button data-dec="${p.id}" aria-label="Quitar uno">−</button>
           <span class="qty">${qty}</span>
           <button data-inc="${p.id}" aria-label="Agregar uno">+</button>
         </div>`
      : `<button class="add-btn" data-add="${p.id}" aria-label="Agregar ${p.nombre}">+</button>`;

  return `
    <div class="product-card ${!p.disponible ? 'unavailable' : ''}">
      <div class="prod-img-wrap ${p.disponible ? 'img-tappable' : ''}" ${imgAction} aria-label="${p.disponible ? 'Agregar ' + p.nombre : ''}">
        ${imgHtml}
        ${p.es_tercero ? `<span class="tercero-badge">Vecino</span>` : ''}
        ${!p.disponible ? `<div class="unavail-overlay">Sin stock</div>` : ''}
        ${p.disponible ? `<div class="img-add-hint">＋</div>` : ''}
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.nombre}</div>
        ${p.marca ? `<div class="prod-brand">${p.marca}</div>` : ''}
        <div class="prod-bottom">
          <span class="prod-price">$${fmt(p.precio)}</span>
          ${actionHtml}
        </div>
      </div>
    </div>`;
}

export function bindProductEvents(container) {
  // Botones explícitos de agregar
  container.querySelectorAll('[data-add]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('kiosco:addToCart', { detail: el.dataset.add }));
    })
  );
  container.querySelectorAll('[data-inc]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.dispatchEvent(
        new CustomEvent('kiosco:changeQty', { detail: { id: el.dataset.inc, delta: 1 } })
      );
    })
  );
  container
    .querySelectorAll('[data-dec]')
    .forEach((btn) =>
      btn.addEventListener('click', () =>
        document.dispatchEvent(
          new CustomEvent('kiosco:changeQty', { detail: { id: btn.dataset.dec, delta: -1 } })
        )
      )
    );
}
