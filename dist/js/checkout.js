/* =============================================
   Módulo de checkout — formulario, GPS, envío WA
   ============================================= */

import { state, saveCart } from './state.js';
import { fmt, showToast } from './utils.js';
import { renderProducts } from './products.js';
import { closeCart, updateBadge } from './cart.js';

// ── DOM refs ──────────────────────────────────
const checkoutSheet = document.getElementById('checkout-sheet');
const overlay = document.getElementById('overlay');
const checkoutNameInput = document.getElementById('checkout-name');
const checkoutAddrInput = document.getElementById('checkout-address');
const locationBtn = document.getElementById('location-btn');
const locationBtnText = document.getElementById('location-btn-text');
const locationHint = document.getElementById('location-hint');

let gpsCoords = null; // { lat, lng }

// ── Helpers ───────────────────────────────────
function resetLocationBtn() {
  locationBtn.className = 'location-btn';
  locationBtnText.textContent = 'Compartir mi ubicación GPS';
  locationHint.textContent = 'Opcional · Se enviará un link de Google Maps en el mensaje';
}

// ── GPS ───────────────────────────────────────
locationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locationBtn.className = 'location-btn error';
    locationBtnText.textContent = 'GPS no disponible en este dispositivo';
    return;
  }
  if (gpsCoords) {
    gpsCoords = null;
    resetLocationBtn();
    return;
  }
  locationBtn.className = 'location-btn loading';
  locationBtnText.textContent = 'Obteniendo ubicación…';
  locationHint.textContent = 'Tu navegador puede pedirte permiso';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      locationBtn.className = 'location-btn success';
      locationBtnText.textContent = '✅ Ubicación obtenida · Tocá para quitar';
      locationHint.textContent = `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`;
    },
    (err) => {
      locationBtn.className = 'location-btn error';
      locationBtnText.textContent =
        err.code === 1
          ? 'Permiso denegado · Enviá la ubicación por WA'
          : 'No se pudo obtener la ubicación';
      locationHint.textContent =
        err.code === 1
          ? 'En WhatsApp: Adjunto → Ubicación → Mi ubicación actual'
          : 'Verificá que el GPS esté activado';
    },
    { timeout: 10000, maximumAge: 60000 }
  );
});

// ── Sheet open / close ────────────────────────
export function openCheckout() {
  checkoutNameInput.value = localStorage.getItem('kiosco_nombre') || '';
  checkoutAddrInput.value = localStorage.getItem('kiosco_direccion') || '';
  gpsCoords = null;
  resetLocationBtn();
  checkoutSheet.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    if (!checkoutNameInput.value) checkoutNameInput.focus();
    else if (!checkoutAddrInput.value) checkoutAddrInput.focus();
  }, 380);
}

export function closeCheckout() {
  checkoutSheet.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Mensaje WhatsApp ──────────────────────────
function buildWhatsApp(subtotal, envio, total, nombre, direccion, coords) {
  const lines = state.cart
    .map((c) => `• ${c.qty}x ${c.nombre} — $${fmt(c.qty * c.precio)}`)
    .join('\n');
  let msg =
    `🛍️ *Pedido Kiosco Digital*\n\n${lines}\n\n` +
    `*Subtotal:* $${fmt(subtotal)}\n` +
    `*Envío:* $${fmt(envio)}\n` +
    `*TOTAL: $${fmt(total)}*\n\n`;

  if (nombre) msg += `👤 *Nombre:* ${nombre}\n`;
  if (direccion) msg += `🏠 *Dirección:* ${direccion}\n`;
  if (coords) {
    msg += `📍 *Ubicación GPS:* https://maps.google.com/?q=${coords.lat},${coords.lng}\n`;
  } else {
    msg += `📍 *Mi dirección:* `;
  }
  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

// ── Confirmar pedido ──────────────────────────
function submitOrder() {
  const nombre = checkoutNameInput.value.trim();
  const direccion = checkoutAddrInput.value.trim();

  if (nombre) localStorage.setItem('kiosco_nombre', nombre);
  if (direccion) localStorage.setItem('kiosco_direccion', direccion);

  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.precio, 0);
  const envio = PRECIO_ENVIO;

  window.open(
    buildWhatsApp(subtotal, envio, subtotal + envio, nombre, direccion, gpsCoords),
    '_blank',
    'noopener,noreferrer'
  );

  // Vaciar carrito
  state.cart.splice(0);
  saveCart();
  updateBadge();
  renderProducts();
  closeCheckout();
  closeCart();
  showToast('🎉 ¡Pedido enviado! Tu carrito fue vaciado');
}

// ── Eventos ───────────────────────────────────
document.getElementById('checkout-confirm').addEventListener('click', submitOrder);
document.getElementById('close-checkout').addEventListener('click', closeCheckout);
document.getElementById('whatsapp-btn').addEventListener('click', openCheckout);
