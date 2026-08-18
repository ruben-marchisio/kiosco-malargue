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
const nameInput = document.getElementById('checkout-name');
const addrInput = document.getElementById('checkout-address');
const callesInput = document.getElementById('checkout-calles');
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

function getPayMethod() {
  const sel = document.querySelector('input[name="pago"]:checked');
  return sel ? sel.value : null;
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
  nameInput.value = localStorage.getItem('kiosco_nombre') || '';
  addrInput.value = localStorage.getItem('kiosco_direccion') || '';
  callesInput.value = localStorage.getItem('kiosco_calles') || '';
  gpsCoords = null;
  resetLocationBtn();
  // Restaurar método de pago guardado
  const savedPago = localStorage.getItem('kiosco_pago') || 'efectivo';
  const pagoRadio = document.querySelector(`input[name="pago"][value="${savedPago}"]`);
  if (pagoRadio) pagoRadio.checked = true;

  checkoutSheet.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    if (!nameInput.value) nameInput.focus();
    else if (!addrInput.value) addrInput.focus();
  }, 380);
}

export function closeCheckout() {
  checkoutSheet.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Mensaje WhatsApp ──────────────────────────
function buildWhatsApp(subtotal, envio, total, nombre, direccion, calles, pago, coords) {
  const sep = '─────────────────────';
  const sep2 = '═════════════════════';

  const lines = state.cart
    .map((c) => {
      const marcaStr = c.marca ? ` (${c.marca})` : '';
      return `  • ${c.qty}× ${c.nombre}${marcaStr}\n    💰 $${fmt(c.qty * c.precio)}`;
    })
    .join('\n');

  const pagoEmoji = pago === 'transferencia' ? '💳' : '💵';
  const pagoLabel = pago === 'transferencia' ? 'Transferencia' : 'Efectivo';

  let msg =
    `🛒 *Pedido — Kiosco Digital El Pechito*\n` +
    `📍 Malargüe, Mendoza\n` +
    `${sep}\n\n` +
    `🧺 *Detalle del pedido:*\n${lines}\n\n` +
    `${sep}\n` +
    `📦 *Subtotal:*  $${fmt(subtotal)}\n` +
    `🚴 *Delivery:*  $${fmt(envio)}\n` +
    `${sep2}\n` +
    `✅ *TOTAL:  $${fmt(total)}*\n` +
    `${sep}\n\n` +
    `👤 *Cliente:* ${nombre || '—'}\n`;

  if (direccion) msg += `🏠 *Dirección:* ${direccion}\n`;
  if (calles) msg += `↔️ *Entre calles:* ${calles}\n`;

  if (coords) {
    msg += `📍 *Ubicación GPS:* https://maps.google.com/?q=${coords.lat},${coords.lng}\n`;
  }

  msg += `${pagoEmoji} *Pago:* ${pagoLabel}\n`;

  return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
}

// ── Confirmar pedido ──────────────────────────
function submitOrder() {
  const nombre = nameInput.value.trim();
  const direccion = addrInput.value.trim();
  const calles = callesInput.value.trim();
  const pago = getPayMethod() || 'efectivo';

  if (nombre) localStorage.setItem('kiosco_nombre', nombre);
  if (direccion) localStorage.setItem('kiosco_direccion', direccion);
  if (calles) localStorage.setItem('kiosco_calles', calles);
  localStorage.setItem('kiosco_pago', pago);

  const subtotal = state.cart.reduce((s, c) => s + c.qty * c.precio, 0);
  const envio = PRECIO_ENVIO;

  window.open(
    buildWhatsApp(subtotal, envio, subtotal + envio, nombre, direccion, calles, pago, gpsCoords),
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
