/* =============================================
   Módulo de productos — catálogo, render, categorías
   Multi-comercio: filtra por store seleccionado
   ============================================= */

import { supabase } from './api.js';
import { state } from './state.js';
import { fmt, skeletons, showToast } from './utils.js';
import { getCachedCatalog, setCatalogCache } from './cache.js';
import { initFromConfig } from './store-status.js';
import { selectedStore, RUBRO_EMOJI } from './stores.js';

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
  renderProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Carga ─────────────────────────────────────
export async function loadProducts() {
  gridEl.innerHTML = skeletons(6);

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
  renderProducts();
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
