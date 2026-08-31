/* =============================================
   Módulo de checkout — formulario, GPS, envío WA
   Guarda pedidos en Supabase + envía por WhatsApp
   ============================================= */

import { state, saveCart } from './state.js';
import { fmt, showToast } from './utils.js';
import { renderProducts } from './products.js';
import { closeCart, updateBadge } from './cart.js';
import { isStoreClosed, showClosedModal, storeStatus } from './store-status.js';
import { supabase } from './api.js';
import { patchStockInCache } from './cache.js';

// comercio_id del local principal (se carga una vez y se cachea)
let _comercioId = null;
async function getComercioPrincipalId() {
  if (_comercioId) return _comercioId;
  const { data } = await supabase
    .from('comercios')
    .select('id')
    .eq('activo', true)
    .order('created_at')
    .limit(1)
    .single();
  _comercioId = data?.id || null;
  return _comercioId;
}

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

  // — Mostrar aviso si el local está cerrado
  const banner = document.getElementById('checkout-closed-banner');
  const ccbMsg = document.getElementById('ccb-msg');
  const ccbIcon = document.getElementById('ccb-icon');
  if (isStoreClosed()) {
    const motivos = { horario: '🌙', clima: '🌧️', delivery: '🛕', otro: '⏸️' };
    ccbIcon.textContent = motivos[storeStatus.motivo] || '🔴';
    const defaultMsg = storeStatus.reapertura
      ? `Cerrado temporalmente. Reapertura estimada: ${storeStatus.reapertura}.`
      : 'No podemos recibir pedidos en este momento.';
    ccbMsg.textContent = storeStatus.mensaje || defaultMsg;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }

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

// ── Validación pre-pedido ────────────────────────────────────
async function validateOrder() {
  // 1. Verif estado del local (usa estado local — sin query)
  if (isStoreClosed()) {
    showClosedModal();
    return false;
  }

  // 2. Verif stock del carrito (query batch)
  const ids = state.cart.map((c) => c.id);
  if (!ids.length) return true;

  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, disponible')
    .in('id', ids);

  if (error) return true; // sin conexión: permitir el pedido con aviso

  // Parchar caché con datos frescos
  const stockMap = {};
  data.forEach((p) => {
    stockMap[p.id] = p.disponible;
  });
  patchStockInCache(stockMap);
  state.allProducts = state.allProducts.map((p) =>
    Object.prototype.hasOwnProperty.call(stockMap, p.id) ? { ...p, disponible: stockMap[p.id] } : p
  );

  const sinStock = data.filter((p) => !p.disponible);
  if (sinStock.length) {
    const nombres = sinStock.map((p) => p.nombre).join(', ');
    showToast(`⚠️ Sin stock: ${nombres}`);
    // Quitar del carrito los productos agotados
    sinStock.forEach((p) => {
      const idx = state.cart.findIndex((c) => c.id === p.id);
      if (idx !== -1) state.cart.splice(idx, 1);
    });
    saveCart();
    updateBadge();
    renderProducts();
    closeCheckout();
    return false;
  }

  return true;
}

// ── Guardar pedido en Supabase ──────────────────────────
async function savePedidoToDB({ nombre, direccion, calles, pago, coords, subtotal, envio }) {
  try {
    const comercioId = await getComercioPrincipalId();
    const items = state.cart.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      marca: c.marca || null,
      qty: c.qty,
      precio: c.precio,
      subtotal: c.qty * c.precio,
    }));

    await supabase.from('pedidos').insert({
      comercio_id: comercioId,
      cliente_nombre: nombre || null,
      direccion: direccion || null,
      entre_calles: calles || null,
      gps_lat: coords?.lat || null,
      gps_lng: coords?.lng || null,
      metodo_pago: pago,
      monto_productos: subtotal,
      monto_envio: envio,
      monto_total: subtotal + envio,
      items,
      estado: 'pendiente',
    });
  } catch (err) {
    // No interrumpir el flujo de WhatsApp si falla el guardado
    console.warn('[checkout] No se pudo guardar el pedido en BD:', err);
  }
}

// ── Confirmar pedido ────────────────────────────────────
async function submitOrder() {
  const valido = await validateOrder();
  if (!valido) return;

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

  // Guardar en BD (no bloquea el WA aunque falle)
  savePedidoToDB({ nombre, direccion, calles, pago, coords: gpsCoords, subtotal, envio });

  // Abrir WhatsApp
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

// ── Eventos ───────────────────────────────────────────
document.getElementById('checkout-confirm').addEventListener('click', submitOrder);
document.getElementById('close-checkout').addEventListener('click', closeCheckout);
document.getElementById('whatsapp-btn').addEventListener('click', openCheckout);
