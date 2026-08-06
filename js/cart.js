/* =============================================
   Módulo del carrito — estado, render, bottom sheet
   ============================================= */

import { state, saveCart } from './state.js';
import { fmt, showToast, setNavActive } from './utils.js';
import { CAT_EMOJI, renderProducts } from './products.js';

// ── DOM refs ──────────────────────────────────
const navBadge = document.getElementById('nav-badge');
const cartSheet = document.getElementById('cart-sheet');
const overlay = document.getElementById('overlay');
const cartItems = document.getElementById('cart-items');
const cartEmpty = document.getElementById('cart-empty');
const cartFooter = document.getElementById('cart-footer');
const subtotalEl = document.getElementById('subtotal');
const envioEl = document.getElementById('envio');
const totalEl = document.getElementById('total');

// ── Badge ─────────────────────────────────────
export function updateBadge() {
  const total = state.cart.reduce((s, c) => s + c.qty, 0);
  navBadge.textContent = total;
  navBadge.style.display = total ? 'flex' : 'none';
}

export function bumpBadge() {
  navBadge.classList.remove('bump');
  void navBadge.offsetWidth; // forzar reflow para reiniciar animación
  navBadge.classList.add('bump');
  setTimeout(() => navBadge.classList.remove('bump'), 350);
}

// ── Acciones de carrito ───────────────────────
export function addToCart(id) {
  const prod = state.allProducts.find((p) => p.id === id);
  if (!prod) return;
  const existing = state.cart.find((c) => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({
      id,
      nombre: prod.nombre,
      precio: prod.precio,
      imagen_url: prod.imagen_url,
      categoria: prod.categoria,
      qty: 1,
    });
  }
  saveCart();
  updateBadge();
  showToast(`✅ ${prod.nombre} agregado`);
  bumpBadge();
  renderProducts();
}

export function changeQty(id, delta) {
  const item = state.cart.find((c) => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    const idx = state.cart.findIndex((c) => c.id === id);
    state.cart.splice(idx, 1);
  }
  saveCart();
  updateBadge();
  bumpBadge();
  renderProducts();
  if (cartSheet.classList.contains('open')) renderCart();
}

// ── Cart Sheet ────────────────────────────────
export function openCart() {
  renderCart();
  cartSheet.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setNavActive('cart');
}

export function closeCart() {
  cartSheet.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  setNavActive('home');
}

export function renderCart() {
  if (!state.cart.length) {
    cartItems.innerHTML = '';
    cartEmpty.style.display = 'block';
    cartFooter.style.display = 'none';
    return;
  }
  cartEmpty.style.display = 'none';
  cartFooter.style.display = 'flex';

  cartItems.innerHTML = state.cart
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
      const idx = state.cart.findIndex((c) => c.id === btn.dataset.remove);
      if (idx !== -1) state.cart.splice(idx, 1);
      saveCart();
      updateBadge();
      renderCart();
      renderProducts();
    });
  });

  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.precio, 0);
  const envio = PRECIO_ENVIO;
  subtotalEl.textContent = `$${fmt(subtotal)}`;
  envioEl.textContent = `$${fmt(envio)}`;
  totalEl.textContent = `$${fmt(subtotal + envio)}`;
}
