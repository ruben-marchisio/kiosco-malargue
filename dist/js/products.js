/* =============================================
   Módulo de productos — catálogo, render, categorías
   ============================================= */

import { supabase } from './api.js';
import { state } from './state.js';
import { fmt, skeletons, showToast } from './utils.js';
import { getCachedCatalog, setCatalogCache } from './cache.js';
import { initFromConfig } from './store-status.js';

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

  // 1. Consultar la versión y estado completo del negocio (1 fila)
  const { data: cfg, error: cfgError } = await supabase
    .from('config_negocio')
    .select('updated_at, stock_version, abierto, motivo_cierre, mensaje_cierre, hora_reapertura')
    .eq('id', 1)
    .single();

  // Inicializar store-status con los datos ya consultados (sin query extra)
  initFromConfig(cfg, cfg?.updated_at ?? null);

  const remoteVersion = cfg?.updated_at ?? null;

  // 2. Si tenemos caché válido y la versión coincide → no descargar nada más
  if (!cfgError && remoteVersion) {
    const cached = getCachedCatalog();
    if (cached && cached.version === remoteVersion) {
      state.allProducts = cached.products;
      renderProducts();
      return; // ✅ Salida rápida — 0 queries adicionales
    }
  }

  // 3. Caché inválido, versión distinta o sin conexión → descargar catálogo completo
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria')
    .order('nombre');

  if (error) {
    // Sin red pero tenemos caché viejo → usarlo como fallback offline
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

  // 4. Guardar en caché y actualizar estado
  if (remoteVersion) setCatalogCache(data, remoteVersion);
  state.allProducts = data;
  renderProducts();
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
