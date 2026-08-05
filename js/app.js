/* =============================================
   Kiosco Digital — App principal (catálogo)
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── Init ──────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

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

let allProducts = [];
let currentCat = 'todo';
let cart = JSON.parse(localStorage.getItem('kiosco_cart') || '[]');

// ── DOM refs ──────────────────────────────────
const gridEl = document.getElementById('products-grid');
const catScroll = document.getElementById('cat-scroll');
const cartCount = document.getElementById('cart-count');
const cartDrawer = document.getElementById('cart-drawer');
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

// ── Categories ────────────────────────────────
CATS.forEach((cat) => {
  const btn = document.createElement('button');
  btn.className = 'cat-btn' + (cat.id === 'todo' ? ' active' : '');
  btn.dataset.cat = cat.id;
  btn.innerHTML = `<span>${cat.emoji}</span> ${cat.label}`;
  btn.addEventListener('click', () => selectCategory(cat.id, btn.textContent.trim()));
  catScroll.appendChild(btn);
});

function selectCategory(id, label) {
  currentCat = id;
  document
    .querySelectorAll('.cat-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.cat === id));
  sectionTitle.textContent = id === 'todo' ? '🛍️ Todos los productos' : label;
  renderProducts();
}

// ── Load products ─────────────────────────────
async function loadProducts() {
  gridEl.innerHTML = skeletons(6);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria')
    .order('nombre');
  if (error) {
    gridEl.innerHTML = `<p style="color:red;padding:20px">Error cargando productos</p>`;
    return;
  }
  allProducts = data;
  renderProducts();
}

function skeletons(n) {
  return Array(n)
    .fill(
      `
    <div style="border-radius:14px;overflow:hidden;border:1.5px solid #FFE0C8">
      <div class="skeleton" style="aspect-ratio:1"></div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
        <div class="skeleton" style="height:14px;border-radius:6px"></div>
        <div class="skeleton" style="height:14px;width:60%;border-radius:6px"></div>
      </div>
    </div>
  `
    )
    .join('');
}

function renderProducts() {
  const filtered =
    currentCat === 'todo' ? allProducts : allProducts.filter((p) => p.categoria === currentCat);

  if (!filtered.length) {
    gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">🔍</div><p>No hay productos en esta categoría</p></div>`;
    return;
  }

  gridEl.innerHTML = filtered.map((p) => productCard(p)).join('');

  // Bind add buttons
  gridEl.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add));
  });
  gridEl.querySelectorAll('[data-inc]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.inc, 1));
  });
  gridEl.querySelectorAll('[data-dec]').forEach((btn) => {
    btn.addEventListener('click', () => changeQty(btn.dataset.dec, -1));
  });
}

function productCard(p) {
  const inCart = cart.find((c) => c.id === p.id);
  const qty = inCart ? inCart.qty : 0;
  const imgHtml = p.imagen_url
    ? `<img class="prod-img" src="${p.imagen_url}" alt="${p.nombre}" loading="lazy">`
    : `<div class="prod-placeholder">${categoryEmoji(p.categoria)}</div>`;

  const actionHtml = !p.disponible
    ? `<button class="add-btn" disabled>+</button>`
    : qty > 0
      ? `<div class="qty-ctrl">
           <button data-dec="${p.id}">−</button>
           <span class="qty">${qty}</span>
           <button data-inc="${p.id}">+</button>
         </div>`
      : `<button class="add-btn" data-add="${p.id}" id="add-${p.id}">+</button>`;

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
          <span class="prod-price">$${formatPrice(p.precio)}</span>
          ${actionHtml}
        </div>
      </div>
    </div>`;
}

function categoryEmoji(cat) {
  const map = {
    bebidas: '🥤',
    snacks: '🍫',
    comidas: '🍽️',
    panaderia: '🥐',
    verduleria: '🥦',
    limpieza: '🧹',
  };
  return map[cat] || '📦';
}

function formatPrice(n) {
  return Number(n).toLocaleString('es-AR');
}

// ── Cart logic ────────────────────────────────
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
  bumpCount();
  renderProducts();
}

function changeQty(id, delta) {
  const item = cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((c) => c.id !== id);
  saveCart();
  bumpCount();
  renderProducts();
}

function saveCart() {
  localStorage.setItem('kiosco_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  cartCount.textContent = total;
  cartCount.style.display = total ? 'flex' : 'none';
}

function bumpCount() {
  cartCount.classList.remove('bump');
  void cartCount.offsetWidth;
  cartCount.classList.add('bump');
  setTimeout(() => cartCount.classList.remove('bump'), 350);
}

// ── Cart Drawer ───────────────────────────────
function openCart() {
  renderCart();
  cartDrawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartDrawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
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
        ? `<img class="cart-item-img" src="${item.imagen_url}" alt="${item.nombre}">`
        : `<div class="cart-item-img">${categoryEmoji(item.categoria)}</div>`;
      return `
      <div class="cart-item">
        ${imgHtml}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nombre}</div>
          <div class="cart-item-price">${item.qty} × $${formatPrice(item.precio)} = $${formatPrice(item.qty * item.precio)}</div>
        </div>
        <button class="cart-item-remove" data-remove="${item.id}" title="Quitar">✕</button>
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

  subtotalEl.textContent = `$${formatPrice(subtotal)}`;
  envioEl.textContent = `$${formatPrice(envio)}`;
  totalEl.textContent = `$${formatPrice(total)}`;
  whatsappBtn.href = buildWhatsApp(subtotal, envio, total);
}

function buildWhatsApp(subtotal, envio, total) {
  const lines = cart
    .map((c) => `• ${c.qty}x ${c.nombre} — $${formatPrice(c.qty * c.precio)}`)
    .join('\n');
  const msg = `🛍️ *Pedido Kiosco Digital*\n\n${lines}\n\n*Subtotal:* $${formatPrice(subtotal)}\n*Envío:* $${formatPrice(envio)}\n*TOTAL: $${formatPrice(total)}*\n\n📍 Mi dirección: `;
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

// ── Toast ─────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Event listeners ───────────────────────────
document.getElementById('cart-btn').addEventListener('click', openCart);
document.getElementById('close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);

// ── Init ──────────────────────────────────────
updateCartCount();
loadProducts();

// ── PWA ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
