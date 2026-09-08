/* global L, ENVIO_CONFIG, CADETERIA_LOCAL_COORDS */
import { supabase } from './api.js';
import { calculateDistance } from './checkout.js';
import { fmt, showToast } from './utils.js';

// DOM Elements - Views & Entry
const homeView = document.getElementById('home-view');
const cadeteriaView = document.getElementById('cadeteria-view');
const btnOpenCadeteria = document.getElementById('btn-open-cadeteria');
const btnBack = document.getElementById('cadeteria-back');

// DOM Elements - Forms
const btnOptPaquete = document.getElementById('btn-opt-paquete');
const btnOptFactura = document.getElementById('btn-opt-factura');
const formPaquete = document.getElementById('form-paquete');
const formFactura = document.getElementById('form-factura');

// Cost Summary Elements
const cadRowFactura = document.getElementById('cad-row-factura');
const cadCostFactura = document.getElementById('cad-cost-factura');
const cadDistLabel = document.getElementById('cad-dist-label');
const cadCostEnvio = document.getElementById('cad-cost-envio');
const cadCostTotal = document.getElementById('cad-cost-total');

// Botones y Mapas
const btnOrigen = document.getElementById('cad-btn-origen');
const hintOrigen = document.getElementById('cad-hint-origen');
const btnDestino = document.getElementById('cad-btn-destino');
const hintDestino = document.getElementById('cad-hint-destino');
const btnFacturaLoc = document.getElementById('cad-btn-factura-loc');
const hintFacturaLoc = document.getElementById('cad-hint-factura-loc');

const mapSheet = document.getElementById('cad-map-sheet');
const btnCloseMap = document.getElementById('close-cad-map');
const btnConfirmMap = document.getElementById('cad-confirm-map-btn');
const dirInput = document.getElementById('cad-dir-input');
const dirBuscar = document.getElementById('cad-dir-buscar');
const dirHint = document.getElementById('cad-dir-hint');

// Botón de confirmar
const btnConfirm = document.getElementById('cad-confirm-btn');

// State
let currentType = 'paquete'; // 'paquete' o 'factura'
let coordsOrigen = null;
let coordsDestino = null;
let coordsFactura = null; // Para cuando se pide pagar factura
let mapInstance = null;
const COSTO_ESPERA_FACTURA = 4000;
const COMISION_FACTURA = 1000; // Lo que gana la app por gestión

// ── NAVEGACIÓN ──────────────────────────────────────────────
btnOpenCadeteria?.addEventListener('click', async () => {
  // Verificamos si está logueado
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    showToast('⚠️ Debes iniciar sesión (Perfil) para usar Cadetería');
    return;
  }

  homeView.style.display = 'none';
  cadeteriaView.style.display = 'block';
  window.scrollTo(0, 0);
  updateCostSummary();

  // Pre-rellenar el nombre del remitente desde Google (o metadata guardada)
  const remitenteInput = document.getElementById('cad-remitente-nombre');
  if (remitenteInput && !remitenteInput.value) {
    const meta = session.user.user_metadata || {};
    const nombre = meta.nombre || meta.full_name || meta.name || '';
    if (nombre) remitenteInput.value = nombre;
  }

  // Toggle campo monto en efectivo
  function toggleCadEfectivo() {
    const isEfectivo =
      document.querySelector('input[name="cad-pago"]:checked')?.value === 'efectivo';
    const wrap = document.getElementById('cad-efectivo-wrap');
    if (wrap) wrap.style.display = isEfectivo ? 'block' : 'none';
  }
  toggleCadEfectivo();
  document
    .querySelectorAll('input[name="cad-pago"]')
    .forEach((r) => r.addEventListener('change', toggleCadEfectivo));
});

btnBack?.addEventListener('click', () => {
  cadeteriaView.style.display = 'none';
  homeView.style.display = 'block';
});

// ── CAMBIO DE TIPO DE SERVICIO ──────────────────────────────
function setType(type) {
  currentType = type;
  if (type === 'paquete') {
    btnOptPaquete.classList.add('active');
    btnOptFactura.classList.remove('active');
    formPaquete.style.display = 'flex';
    formFactura.style.display = 'none';
  } else {
    btnOptFactura.classList.add('active');
    btnOptPaquete.classList.remove('active');
    formFactura.style.display = 'flex';
    formPaquete.style.display = 'none';
  }
  updateCostSummary();
}

btnOptPaquete?.addEventListener('click', () => setType('paquete'));
btnOptFactura?.addEventListener('click', () => setType('factura'));

// Recalcular cuando cambia el monto de la factura
document.getElementById('cad-factura-monto')?.addEventListener('input', updateCostSummary);

// ── OBTENER GPS DE ORIGEN ──────────────────────────────────
function handleGetLocation(btn, hint, onCoordsSuccess) {
  if (!navigator.geolocation) {
    hint.textContent = 'GPS no disponible';
    return;
  }

  btn.classList.add('loading');
  hint.textContent = 'Obteniendo...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      btn.classList.remove('loading');
      btn.classList.add('success');
      btn.innerHTML = '✅ Ubicación obtenida';
      hint.textContent = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      onCoordsSuccess(coords);
    },
    () => {
      btn.classList.remove('loading');
      hint.textContent = 'Permiso denegado. Activa tu GPS.';
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

btnOrigen?.addEventListener('click', () => {
  handleGetLocation(btnOrigen, hintOrigen, (coords) => {
    coordsOrigen = coords;
    updateCostSummary();
  });
});

btnFacturaLoc?.addEventListener('click', () => {
  handleGetLocation(btnFacturaLoc, hintFacturaLoc, (coords) => {
    coordsFactura = coords;
    updateCostSummary();
  });
});

// ── OBTENER GPS DE DESTINO (MAPA INTERACTIVO) ───────────────
function initMap() {
  if (mapInstance) return;
  // Centro por defecto: ubicación real del local
  const centerLat =
    typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lat : -35.5069891;
  const centerLng =
    typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lng : -69.5826686;

  mapInstance = L.map('cad-map').setView([centerLat, centerLng], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
  }).addTo(mapInstance);

  // Agregar marcador estático en el centro simulado por CSS
  const centerMarker = document.createElement('div');
  centerMarker.className = 'center-marker';
  centerMarker.innerHTML = '📍';
  document.getElementById('cad-map').appendChild(centerMarker);
}

btnDestino?.addEventListener('click', () => {
  mapSheet.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Necesitamos un pequeño timeout para que Leaflet renderice bien cuando el modal se abre
  setTimeout(() => {
    initMap();
    mapInstance.invalidateSize();
    // Si ya teníamos origen, centramos ahí
    if (coordsOrigen) {
      mapInstance.setView([coordsOrigen.lat, coordsOrigen.lng], 15);
    }
  }, 300);
});

btnCloseMap?.addEventListener('click', () => {
  mapSheet.classList.remove('open');
  document.body.style.overflow = '';
});

// ── BUSCADOR DE DIRECCIÓN (PUNTO B) ────────────────────────
async function buscarDireccion() {
  const texto = dirInput?.value.trim();
  if (!texto) {
    if (dirHint) dirHint.textContent = '⚠️ Escribí una dirección primero.';
    return;
  }

  if (dirHint) dirHint.textContent = '🔍 Buscando...';
  if (dirBuscar) dirBuscar.disabled = true;

  try {
    // Nominatim: buscamos en contexto de Malargüe para mayor precisión
    const query = encodeURIComponent(`${texto}, Malargüe, Mendoza, Argentina`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es', 'User-Agent': 'KioscoMalargue/1.0' },
    });
    const data = await res.json();

    if (!data || data.length === 0) {
      if (dirHint)
        dirHint.textContent =
          '❌ No encontré esa dirección. Revisá el texto o mové el mapa manualmente.';
      return;
    }

    const { lat, lon, display_name } = data[0];
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lon);

    // Centramos el mapa en la dirección encontrada
    mapInstance.setView([latNum, lngNum], 16);

    // Mostramos nombre corto (hasta la primera coma)
    const nombreCorto = display_name.split(',').slice(0, 2).join(',');
    if (dirHint) {
      dirHint.style.color = 'var(--success, #22c55e)';
      dirHint.textContent = `✅ ${nombreCorto}`;
    }
  } catch {
    if (dirHint) dirHint.textContent = '❌ Error de conexión. Mové el mapa manualmente.';
  } finally {
    if (dirBuscar) dirBuscar.disabled = false;
  }
}

dirBuscar?.addEventListener('click', buscarDireccion);
dirInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    buscarDireccion();
  }
});

btnConfirmMap?.addEventListener('click', () => {
  const center = mapInstance.getCenter();
  coordsDestino = { lat: center.lat, lng: center.lng };

  btnDestino.classList.remove('outline');
  btnDestino.classList.add('success');

  // Si habían escrito una dirección, la mostramos como label
  const dirTexto = dirInput?.value.trim();
  btnDestino.innerHTML = dirTexto ? `✅ ${dirTexto}` : '✅ Destino marcado en mapa';
  hintDestino.textContent = `${coordsDestino.lat.toFixed(5)}, ${coordsDestino.lng.toFixed(5)}`;

  mapSheet.classList.remove('open');
  document.body.style.overflow = '';

  updateCostSummary();
});

// ── CÁLCULO DE COSTOS ───────────────────────────────────────
function getEnvioConfig() {
  return typeof ENVIO_CONFIG !== 'undefined'
    ? ENVIO_CONFIG
    : { base: 1500, distanciaBase: 1.5, extraPorKm: 500, maximo: 4000 };
}

function calcularCostoDistancia(dist) {
  const cfg = getEnvioConfig();
  let costo = cfg.base;
  if (dist > cfg.distanciaBase) {
    const extraKm = dist - cfg.distanciaBase;
    costo += extraKm * cfg.extraPorKm;
  }
  if (costo > cfg.maximo) costo = cfg.maximo;
  return Math.round(costo / 100) * 100;
}

function updateCostSummary() {
  if (currentType === 'paquete') {
    cadRowFactura.style.display = 'none';

    if (coordsOrigen && coordsDestino) {
      const dist = calculateDistance(
        coordsOrigen.lat,
        coordsOrigen.lng,
        coordsDestino.lat,
        coordsDestino.lng
      );
      const costo = calcularCostoDistancia(dist);
      cadDistLabel.textContent = `(${dist.toFixed(1)} km)`;
      cadCostEnvio.textContent = `$${fmt(costo)}`;
      cadCostTotal.textContent = `$${fmt(costo)}`;
    } else {
      cadDistLabel.textContent = '';
      cadCostEnvio.textContent = 'A calcular';
      cadCostTotal.textContent = '$0';
    }
  } else if (currentType === 'factura') {
    cadRowFactura.style.display = 'flex';

    const montoFactura = parseFloat(document.getElementById('cad-factura-monto').value) || 0;
    cadCostFactura.textContent = `$${fmt(montoFactura)}`;

    // El costo de factura es: Costo de espera (4000) + Comisión app (1000) + Costo de viaje (desde el local hasta el cliente)
    const localLat =
      typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lat : -35.5069891;
    const localLng =
      typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lng : -69.5826686;
    let costoLogistica = COSTO_ESPERA_FACTURA + COMISION_FACTURA;

    if (coordsFactura) {
      const dist = calculateDistance(localLat, localLng, coordsFactura.lat, coordsFactura.lng);
      const costoViaje = calcularCostoDistancia(dist);
      costoLogistica += costoViaje;
      cadDistLabel.textContent = `(Espera + ${dist.toFixed(1)} km)`;
    } else {
      costoLogistica += getEnvioConfig().base; // Valor por defecto
      cadDistLabel.textContent = `(Espera + Base)`;
    }

    cadCostEnvio.textContent = `$${fmt(costoLogistica)}`;
    cadCostTotal.textContent = `$${fmt(montoFactura + costoLogistica)}`;
  }
}

// ── GUARDAR Y CONFIRMAR ────────────────────────────────────
btnConfirm?.addEventListener('click', async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const meta = session?.user?.user_metadata || {};
  // El nombre lo tomamos del campo del formulario (pre-rellenado desde Google, editable por el usuario)
  const remitenteInput = document.getElementById('cad-remitente-nombre');
  const userName =
    remitenteInput?.value.trim() ||
    meta.nombre ||
    meta.full_name ||
    meta.name ||
    session?.user?.email?.split('@')[0] ||
    'Cliente';
  const waNum = typeof WHATSAPP_NUM !== 'undefined' ? WHATSAPP_NUM : '5492604055198';

  let msg = '';

  if (remitenteInput && !remitenteInput.value.trim())
    return showToast('⚠️ Ingresá tu nombre antes de continuar.');

  if (currentType === 'paquete') {
    const desc = document.getElementById('cad-paquete-desc').value.trim();
    const destinatario = document.getElementById('cad-paquete-destinatario').value.trim();
    const phone = document.getElementById('cad-paquete-phone').value.trim();
    const terms = document.getElementById('cad-paquete-terms').checked;
    const cadPago = document.querySelector('input[name="cad-pago"]:checked')?.value || 'efectivo';
    const cadMontoEfectivo =
      cadPago === 'efectivo'
        ? parseFloat(document.getElementById('cad-efectivo-monto')?.value || '0') || null
        : null;

    if (!desc) return showToast('⚠️ Ingresa qué contiene el paquete.');
    if (!destinatario) return showToast('⚠️ Ingresá el nombre del destinatario.');
    if (!coordsOrigen || !coordsDestino)
      return showToast('⚠️ Faltan ubicaciones (Punto A y Punto B).');
    if (!terms) return showToast('⚠️ Debes aceptar los términos de seguridad del paquete.');

    const dist = calculateDistance(
      coordsOrigen.lat,
      coordsOrigen.lng,
      coordsDestino.lat,
      coordsDestino.lng
    );
    const costo = calcularCostoDistancia(dist);

    const cadPagoEmoji = cadPago === 'transferencia' ? '💳' : '💵';
    const cadPagoLabel = cadPago === 'transferencia' ? 'Transferencia' : 'Efectivo';
    let cadPagoStr = cadPagoLabel;
    if (cadPago === 'efectivo' && cadMontoEfectivo) {
      const vuelto = cadMontoEfectivo - costo;
      cadPagoStr = `Efectivo · Paga con $${fmt(cadMontoEfectivo)}${vuelto > 0 ? ` · Vuelto: $${fmt(vuelto)}` : ''}`;
    }

    msg =
      `📦 *ENVÍO DE PAQUETE*\n` +
      `👤 *Cliente:* ${userName}\n` +
      `ℹ️ *Contiene:* ${desc}\n` +
      `👥 *Destinatario:* ${destinatario}\n` +
      (phone ? `📞 *Tel. Destinatario:* ${phone}\n` : '') +
      `\n📍 *PUNTO A (RETIRO):* https://maps.google.com/?q=${coordsOrigen.lat},${coordsOrigen.lng}\n` +
      `🏁 *PUNTO B (ENTREGA):* https://maps.google.com/?q=${coordsDestino.lat},${coordsDestino.lng}\n` +
      `\n${cadPagoEmoji} *Pago:* ${cadPagoStr}\n` +
      `💰 *Total del viaje:* $${fmt(costo)}`;

    // Guardar en base de datos
    await supabase.from('pedidos').insert({
      comercio_id: typeof CADETERIA_LOCAL_ID !== 'undefined' ? CADETERIA_LOCAL_ID : null,
      cliente_id: session.user.id,
      cliente_nombre: userName,
      cliente_tel: phone || null,
      gps_lat: coordsDestino.lat,
      gps_lng: coordsDestino.lng,
      monto_productos: 0,
      monto_envio: costo,
      monto_total: costo,
      metodo_pago: cadPago,
      estado: 'pendiente',
      items: [
        {
          tipo: 'cadeteria_paquete',
          descripcion: desc,
          destinatario: destinatario,
          telefono_destinatario: phone || null,
          monto_efectivo: cadMontoEfectivo,
          origen: coordsOrigen,
          destino: coordsDestino,
        },
      ],
    });
  } else if (currentType === 'factura') {
    const monto = parseFloat(document.getElementById('cad-factura-monto').value);

    if (!monto || isNaN(monto) || monto <= 0)
      return showToast('⚠️ Ingresa un monto de factura válido.');
    if (!coordsFactura) return showToast('⚠️ Debes compartir tu ubicación GPS.');

    const localLat =
      typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lat : -35.5069891;
    const localLng =
      typeof CADETERIA_LOCAL_COORDS !== 'undefined' ? CADETERIA_LOCAL_COORDS.lng : -69.5826686;
    const dist = calculateDistance(localLat, localLng, coordsFactura.lat, coordsFactura.lng);
    const costoViaje = calcularCostoDistancia(dist);
    const costoLogistica = COSTO_ESPERA_FACTURA + COMISION_FACTURA + costoViaje;
    const total = monto + costoLogistica;

    msg =
      `🧾 *PAGO DE FACTURA*\n` +
      `👤 *Cliente:* ${userName}\n` +
      `\n💵 *Monto de Factura:* $${fmt(monto)}\n` +
      `🛵 *Costo Logística (Espera + Viaje):* $${fmt(costoLogistica)}\n` +
      `✅ *Total a Transferir:* $${fmt(total)}\n` +
      `\n📍 *Entregar comprobante en:* https://maps.google.com/?q=${coordsFactura.lat},${coordsFactura.lng}\n` +
      `\n⚠️ *Te envío la boleta en el siguiente mensaje.*`;

    // Guardar en base de datos
    await supabase.from('pedidos').insert({
      comercio_id: typeof CADETERIA_LOCAL_ID !== 'undefined' ? CADETERIA_LOCAL_ID : null,
      cliente_id: session.user.id,
      cliente_nombre: userName,
      gps_lat: coordsFactura.lat,
      gps_lng: coordsFactura.lng,
      monto_productos: monto, // Guardamos la factura como producto
      monto_envio: costoLogistica,
      monto_total: total,
      metodo_pago: 'transferencia', // Obligatorio transferencia
      estado: 'pendiente',
      items: [
        {
          tipo: 'cadeteria_factura',
          descripcion: `Pago factura por $${fmt(monto)}`,
          destino: coordsFactura,
        },
      ],
    });
  }

  // Enviar a WhatsApp
  const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  // Limpiar y volver
  cadeteriaView.style.display = 'none';
  homeView.style.display = 'block';
  showToast('¡Solicitud iniciada! Continúa por WhatsApp.');
});
