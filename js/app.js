/* =============================================
   Kiosco Digital — App principal (catálogo)
   Mobile-first PWA
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Categorías ────────────────────────────────
const CATS = [
  { id: 'todo', label: 'Todo', emoji: '🛍️' },
  { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { id: 'snacks', label: 'Snacks', emoji: '🍫' },
  { id: 'comidas', label: 'Comidas', emoji: '🍽️' },
  { id: 'panaderia', label: 'Panadería', emoji: '🥐' },
  { id: 'verduleria', label: 'Verdulería', emoji: '🥦' },
  { id: 'limpieza', label: 'Limpieza', emoji: '🧹' },
  { id: 'otros', label: 'Otros', emoji: '📦' },
];

const CAT_EMOJI = {
  bebidas: '🥤',
  snacks: '🍫',
  comidas: '🍽️',
  panaderia: '🥐',
  verduleria: '🥦',
  limpieza: '🧹',
  otros: '📦',
};

// ── Estado ────────────────────────────────────
let allProducts = [];
let currentCat = 'todo';
let cart = JSON.parse(localStorage.getItem('kiosco_cart') || '[]');
let deferredInstallPrompt = null;

// ── DOM refs ──────────────────────────────────
const gridEl = document.getElementById('products-grid');
const catScroll = document.getElementById('cat-scroll');
const navBadge = document.getElementById('nav-badge');
const cartSheet = document.getElementById('cart-sheet');
const overlay = document.getElementById('overlay');
const cartItems = document.getElementById('cart-items');
const cartEmpty = document.getElementById('cart-empty');
const cartFooter = document.getElementById('cart-footer');
const subtotalEl = document.getElementById('subtotal');
const envioEl = document.getElementById('envio');
const totalEl = document.getElementById('total');
const whatsappBtn = document.getElementById('whatsapp-btn');
const toast = document.getElementById('toast');
const sectionTitle = document.getElementById('section-title');
const searchOverlay = document.getElementById('search-overlay');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const installBanner = document.getElementById('install-banner');

// ── Categorías ────────────────────────────────
CATS.forEach((cat) => {
  const btn = document.createElement('button');
  btn.className = 'cat-btn' + (cat.id === 'todo' ? ' active' : '');
  btn.dataset.cat = cat.id;
  btn.innerHTML = `<span>${cat.emoji}</span> ${cat.label}`;
  btn.addEventListener('click', () => selectCategory(cat.id, `${cat.emoji} ${cat.label}`));
  catScroll.appendChild(btn);
});

function selectCategory(id, label) {
  currentCat = id;
  document
    .querySelectorAll('.cat-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.cat === id));
  sectionTitle.textContent = id === 'todo' ? '🛍️ Todos los productos' : label;
  renderProducts();
  // Scroll al top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Carga de productos ────────────────────────
async function loadProducts() {
  gridEl.innerHTML = skeletons(6);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria')
    .order('nombre');
  if (error) {
    gridEl.innerHTML = `<p style="color:red;padding:20px;grid-column:1/-1">Error al cargar productos. Verificá tu conexión.</p>`;
    return;
  }
  allProducts = data;
  renderProducts();
  loadConfig();
}

async function loadConfig() {
  const { data } = await supabase.from('config_negocio').select('abierto').eq('id', 1).single();
  if (!data) return;
  const badge = document.getElementById('status-badge');
  const txt = document.getElementById('status-text');
  if (!data.abierto) {
    badge.classList.add('closed');
    badge.querySelector('.status-dot').style.animation = 'none';
    txt.textContent = 'Cerrado';
  }
}

function skeletons(n) {
  return Array(n)
    .fill(
      `<div style="border-radius:16px;overflow:hidden;border:1px solid #eee;background:white">
        <div class="skeleton" style="aspect-ratio:1"></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
          <div class="skeleton" style="height:13px;border-radius:6px"></div>
          <div class="skeleton" style="height:13px;width:55%;border-radius:6px"></div>
        </div>
      </div>`
    )
    .join('');
}

function renderProducts(list = null) {
  const source = list ?? allProducts;
  const filtered =
    list !== null
      ? source
      : currentCat === 'todo'
        ? source
        : source.filter((p) => p.categoria === currentCat);

  if (!filtered.length) {
    gridEl.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>No hay productos aquí</p></div>`;
    return;
  }

  gridEl.innerHTML = filtered.map((p) => productCard(p)).join('');
  bindProductEvents(gridEl);
}

function productCard(p) {
  const inCart = cart.find((c) => c.id === p.id);
  const qty = inCart ? inCart.qty : 0;

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
      <div class="prod-img-wrap">
        ${imgHtml}
        ${p.es_tercero ? `<span class="tercero-badge">Vecino</span>` : ''}
        ${!p.disponible ? `<div class="unavail-overlay">Sin stock</div>` : ''}
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.nombre}</div>
        <div class="prod-bottom">
          <span class="prod-price">$${fmt(p.precio)}</span>
          ${actionHtml}
        </div>
      </div>
    </div>`;
}

function bindProductEvents(container) {
  container.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add));
  });
  container.querySelectorAll('[data-inc]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.inc, 1));
  });
  container.querySelectorAll('[data-dec]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.dec, -1));
  });
}

function fmt(n) {
  return Number(n).toLocaleString('es-AR');
}

// ── Carrito ───────────────────────────────────
function addToCart(id) {
  const prod = allProducts.find((p) => p.id === id);
  if (!prod) return;
  const existing = cart.find((c) => c.id === id);
  if (existing) existing.qty++;
  else
    cart.push({
      id,
      nombre: prod.nombre,
      precio: prod.precio,
      imagen_url: prod.imagen_url,
      categoria: prod.categoria,
      qty: 1,
    });
  saveCart();
  showToast(`✅ ${prod.nombre} agregado`);
  bumpBadge();
  renderProducts();
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  saveCart();
  bumpBadge();
  renderProducts();
  if (cartSheet.classList.contains('open')) renderCart();
}

function saveCart() {
  localStorage.setItem('kiosco_cart', JSON.stringify(cart));
  updateBadge();
}

function updateBadge() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  navBadge.textContent = total;
  navBadge.style.display = total ? 'flex' : 'none';
}

function bumpBadge() {
  navBadge.classList.remove('bump');
  void navBadge.offsetWidth;
  navBadge.classList.add('bump');
  setTimeout(() => navBadge.classList.remove('bump'), 350);
}

// ── Cart Sheet ────────────────────────────────
function openCart() {
  renderCart();
  cartSheet.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setNavActive('cart');
}

function closeCart() {
  cartSheet.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  setNavActive('home');
}

function renderCart() {
  if (!cart.length) {
    cartItems.innerHTML = '';
    cartEmpty.style.display = 'block';
    cartFooter.style.display = 'none';
    return;
  }
  cartEmpty.style.display = 'none';
  cartFooter.style.display = 'flex';

  cartItems.innerHTML = cart
    .map((item) => {
      const imgHtml = item.imagen_url
        ? `<div class="cart-item-img"><img src="${item.imagen_url}" alt="${item.nombre}"></div>`
        : `<div class="cart-item-img">${CAT_EMOJI[item.categoria] || '📦'}</div>`;
      return `
        <div class="cart-item">
          ${imgHtml}
          <div class="cart-item-info">
            <div class="cart-item-name">${item.nombre}</div>
            <div class="cart-item-price">${item.qty} × $${fmt(item.precio)} = $${fmt(item.qty * item.precio)}</div>
          </div>
          <button class="cart-item-remove" data-remove="${item.id}" aria-label="Quitar ${item.nombre}">✕</button>
        </div>`;
    })
    .join('');

  cartItems.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cart = cart.filter((c) => c.id !== btn.dataset.remove);
      saveCart();
      renderCart();
      renderProducts();
    });
  });

  const subtotal = cart.reduce((s, c) => s + c.qty * c.precio, 0);
  const envio = PRECIO_ENVIO;
  const total = subtotal + envio;

  subtotalEl.textContent = `$${fmt(subtotal)}`;
  envioEl.textContent = `$${fmt(envio)}`;
  totalEl.textContent = `$${fmt(total)}`;
  whatsappBtn.href = buildWhatsApp(subtotal, envio, total);
}

function buildWhatsApp(subtotal, envio, total) {
  const lines = cart.map((c) => `• ${c.qty}x ${c.nombre} — $${fmt(c.qty * c.precio)}`).join('\n');
  const msg =
    `🛍️ *Pedido Kiosco Digital*\n\n${lines}\n\n` +
    `*Subtotal:* $${fmt(subtotal)}\n` +
    `*Envío:* $${fmt(envio)}\n` +
    `*TOTAL: $${fmt(total)}*\n\n` +
    `📍 Mi dirección: `;
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

// ── Search Overlay ────────────────────────────
function openSearch() {
  searchOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => searchInput.focus(), 300);
  setNavActive('search');
}

function closeSearch() {
  searchOverlay.classList.remove('open');
  document.body.style.overflow = '';
  searchInput.value = '';
  searchResults.innerHTML = `<div class="search-hint"><div class="emoji">🔍</div><p>Escribí para buscar productos</p></div>`;
  setNavActive('home');
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    searchResults.innerHTML = `<div class="search-hint"><div class="emoji">🔍</div><p>Escribí para buscar productos</p></div>`;
    return;
  }
  const results = allProducts.filter(
    (p) => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
  );
  if (!results.length) {
    searchResults.innerHTML = `<div class="search-hint"><div class="emoji">😕</div><p>Sin resultados para "<strong>${q}</strong>"</p></div>`;
    return;
  }
  searchResults.innerHTML = `<div class="products-grid">${results.map((p) => productCard(p)).join('')}</div>`;
  bindProductEvents(searchResults);
});

// ── Bottom Nav ────────────────────────────────
function setNavActive(tab) {
  document.getElementById('nav-home').classList.toggle('active', tab === 'home');
  document.getElementById('nav-search').classList.toggle('active', tab === 'search');
  document.getElementById('nav-cart').classList.toggle('active', tab === 'cart');
}

document.getElementById('nav-home').addEventListener('click', () => {
  closeCart();
  closeSearch();
  setNavActive('home');
});

document.getElementById('nav-search').addEventListener('click', () => {
  closeCart();
  openSearch();
});

document.getElementById('nav-cart').addEventListener('click', () => {
  closeSearch();
  openCart();
});

document.getElementById('search-bar-trigger').addEventListener('click', openSearch);
document.getElementById('search-cancel').addEventListener('click', closeSearch);
document.getElementById('close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', () => {
  closeCart();
  closeSearch();
});

// ── Toast ─────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Install Prompt (PWA) ──────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // Mostrar banner solo si no fue descartado antes
  if (!sessionStorage.getItem('install_dismissed')) {
    installBanner.classList.add('show');
  }
});

document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    installBanner.classList.remove('show');
    showToast('🎉 ¡App instalada! Buscala en tu pantalla de inicio');
  }
  deferredInstallPrompt = null;
});

document.getElementById('install-dismiss').addEventListener('click', () => {
  installBanner.classList.remove('show');
  sessionStorage.setItem('install_dismissed', '1');
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  deferredInstallPrompt = null;
});

// ── Init ──────────────────────────────────────
updateBadge();
loadProducts();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
