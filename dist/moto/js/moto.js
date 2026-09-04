/* =============================================
   Panel Repartidor — moto.js
   Gestión de pedidos en tiempo real con Supabase
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── State ──────────────────────────────────────
let myUserId = null;
let myRepId = null;
let myNombre = 'Repartidor';
let realtimeCh = null;
let activeTrip = null;

// ── Variables GPS ─────────────────────────────
let gpsChannel = null;
let gpsInterval = null;

// ── DOM ────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// ── Format helpers ─────────────────────────────
const fmt = (n) => Number(n).toLocaleString('es-AR');
const timeAgo = (iso) => {
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  return `Hace ${Math.floor(mins / 60)}h`;
};
const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// ── Auth ───────────────────────────────────────
supabase.auth.onAuthStateChange((_e, session) => {
  if (session) {
    myUserId = session.user.id;
    showApp();
  } else {
    showLogin();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) loginError.textContent = 'Email o contraseña incorrectos';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  if (realtimeCh) await supabase.removeChannel(realtimeCh);
  stopGpsTracking();
  await supabase.auth.signOut();
});

// ── Show / Hide ────────────────────────────────
function showLogin() {
  loginScreen.removeAttribute('hidden');
  appScreen.setAttribute('hidden', '');
}

async function showApp() {
  loginScreen.setAttribute('hidden', '');
  appScreen.removeAttribute('hidden');
  await loadRepartidor();
  await loadAll();
  subscribeRealtime();
  startGpsTracking(); // Iniciar transmisión de ubicación
}

// ── Cargar datos del repartidor ─────────────────
async function loadRepartidor() {
  const { data } = await supabase
    .from('repartidores')
    .select('id, nombre')
    .eq('user_id', myUserId)
    .eq('activo', true)
    .maybeSingle();

  if (data) {
    myRepId = data.id;
    myNombre = data.nombre;
    document.getElementById('rep-name').textContent = data.nombre;
  } else {
    document.getElementById('rep-name').textContent = 'Repartidor';
  }
}

// ── GPS Tracking (Realtime Presence) ────────────
let watchId = null;

async function startGpsTracking() {
  if (!myRepId) return;

  if (!gpsChannel) {
    gpsChannel = supabase.channel('motos-gps');
    await gpsChannel.subscribe();
  }

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (gpsChannel) {
          gpsChannel
            .track({
              repartidor_id: myRepId,
              nombre: myNombre,
              lat: latitude,
              lng: longitude,
              updated_at: new Date().toISOString(),
            })
            .catch((err) => console.warn('Error al enviar track:', err));
        }
      },
      (err) => console.warn('Error GPS moto:', err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  }
}

function stopGpsTracking() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (gpsChannel) {
    gpsChannel.untrack();
    supabase.removeChannel(gpsChannel);
    gpsChannel = null;
  }
}

// ── Cargar todo ─────────────────────────────────
async function loadAll() {
  await checkActiveTrip();
  await Promise.all([loadRadar(), loadDisponibles(), loadMiViaje(), loadHoy()]);
}

async function checkActiveTrip() {
  if (!myUserId) return;
  const { data } = await supabase
    .from('pedidos')
    .select('id, estado')
    .eq('repartidor_id', myUserId)
    .in('estado', ['en_preparacion', 'listo', 'en_camino'])
    .maybeSingle();
  activeTrip = data;
}

// ── Realtime ────────────────────────────────────
function subscribeRealtime() {
  if (realtimeCh) supabase.removeChannel(realtimeCh);

  realtimeCh = supabase
    .channel('moto-pedidos')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pedidos',
      },
      () => loadAll()
    )
    .subscribe();
}

// ── Tab Radar (En Preparación) ──────────────────
async function loadRadar() {
  if (activeTrip) {
    const list = document.getElementById('radar-list');
    list.innerHTML = `<div class="radar-idle"><div class="radar-circle">🏍️</div><p>Tenés un viaje en curso. Terminalo para ver más pedidos.</p></div>`;
    updateTabCount('count-radar', 0, false);
    return;
  }

  const { data } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre, coords_lat, coords_lng)')
    .eq('estado', 'en_preparacion')
    .is('repartidor_id', null)
    .order('created_at');

  const list = document.getElementById('radar-list');
  const count = data?.length || 0;
  updateTabCount('count-radar', count, false);

  if (!count) {
    list.innerHTML = `
      <div class="radar-idle">
        <div class="radar-circle">📡</div>
        <p>Sin pedidos en preparación</p>
      </div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (p) => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-store">🏪 ${p.comercios?.nombre || 'Comercio'}</div>
          <div class="order-time">${timeAgo(p.created_at)}</div>
        </div>
        <span class="order-status status-en_preparacion">En preparación</span>
      </div>
      <div class="order-row"><span class="label">📍</span><span class="val">${p.direccion || '—'}</span></div>
      ${p.entre_calles ? `<div class="order-row"><span class="label">↔️</span><span class="val">${p.entre_calles}</span></div>` : ''}
      ${renderItems(p.items)}
      <button class="btn-action btn-tomar" style="margin-top:16px" onclick="aceptarViaje('${p.id}')">
        🏍️ Asignarme (Ir al local)
      </button>
    </div>`
    )
    .join('');
}

// ── Tab Disponibles (Listo para retirar) ──────────
async function loadDisponibles() {
  if (activeTrip) {
    const list = document.getElementById('disponibles-list');
    list.innerHTML = `<div class="state-empty"><div class="icon">🏍️</div><p>Tenés un viaje en curso.</p></div>`;
    updateTabCount('count-disponibles', 0, false);
    return;
  }

  const { data } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre, coords_lat, coords_lng)')
    .eq('estado', 'listo')
    .is('repartidor_id', null)
    .order('updated_at');

  const list = document.getElementById('disponibles-list');
  const count = data?.length || 0;
  updateTabCount('count-disponibles', count, true);

  if (!count) {
    list.innerHTML = `<div class="state-empty"><div class="icon">🟢</div><p>No hay pedidos listos por ahora</p></div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (p) => `
    <div class="order-card listo">
      <div class="order-header">
        <div>
          <div class="order-store">🏪 ${p.comercios?.nombre || 'Comercio'}</div>
          <div class="order-time">Listo desde: ${timeAgo(p.updated_at)}</div>
        </div>
        <span class="order-status status-listo">¡Listo!</span>
      </div>
      <div class="order-row"><span class="label">👤</span><span class="val">${p.cliente_nombre || '—'}</span></div>
      <div class="order-row"><span class="label">📍</span><span class="val">${p.direccion || '—'}</span></div>
      ${p.entre_calles ? `<div class="order-row"><span class="label">↔️</span><span class="val">${p.entre_calles}</span></div>` : ''}
      ${renderItems(p.items)}
      ${renderPaymentInfo(p)}
      <button class="btn-action btn-tomar" style="margin-top:16px" onclick="aceptarViaje('${p.id}')">
        🏍️ Asignarme y retirar
      </button>
    </div>`
    )
    .join('');
}

// ── Tab Mi Viaje activo ──────────────────────────
async function loadMiViaje() {
  if (!myUserId) return;

  const { data: p } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre, coords_lat, coords_lng)')
    .eq('repartidor_id', myUserId)
    .in('estado', ['en_preparacion', 'listo', 'en_camino'])
    .maybeSingle();

  const container = document.getElementById('viaje-content');

  if (!p) {
    container.innerHTML = `<div class="state-empty"><div class="icon">🛵</div><p>No tenés un viaje activo</p></div>`;
    return;
  }

  const isRetirado = p.estado === 'en_camino';

  let headerHtml = '';
  if (p.estado === 'en_preparacion') {
    headerHtml = `<div class="viaje-title" style="color:var(--primary)">⏳ Local Preparando</div><p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Andá al local y esperá a que esté listo.</p>`;
  } else if (p.estado === 'listo') {
    headerHtml = `<div class="viaje-title" style="color:var(--green)">✅ Listo para retirar</div><p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Retirá el pedido en el local.</p>`;
  } else if (p.estado === 'en_camino') {
    headerHtml = `<div class="viaje-title" style="color:var(--primary)">🛵 En Camino</div><p style="color:var(--text-muted);font-size:14px;margin-bottom:12px">Llevá el pedido al cliente.</p>`;
  }

  const linkLocal = p.comercios?.coords_lat
    ? `https://maps.google.com/?q=${p.comercios.coords_lat},${p.comercios.coords_lng}`
    : null;
  const linkCliente =
    p.gps_lat && p.gps_lng ? `https://maps.google.com/?q=${p.gps_lat},${p.gps_lng}` : null;

  let locationHtml = '';
  let actionHtml = '';

  if (!isRetirado) {
    locationHtml = `
      <div style="font-weight:700;margin-bottom:4px">🏪 Local: ${p.comercios?.nombre || 'Comercio'}</div>
      ${
        linkLocal
          ? `<a href="${linkLocal}" target="_blank" rel="noopener" class="btn-action btn-local" style="display:block;text-align:center;text-decoration:none;margin-bottom:16px">📍 Abrir mapa del local</a>`
          : `<p style="color:var(--text-muted)">Sin coordenadas del local</p>`
      }
    `;
    actionHtml = `
      <button class="btn-action btn-tomar" onclick="marcarRetirado('${p.id}')">
        📦 Ya lo retiré (Ir al cliente)
      </button>
      <button class="btn-action btn-danger" style="margin-top:12px;background:transparent;border:1px solid #ef4444;color:#ef4444" onclick="cancelarViaje('${p.id}', '${p.estado}')">
        🚨 Cancelar viaje (Emergencia)
      </button>
    `;
  } else {
    let contactoHtml = '';
    if (p.cliente_tel) {
      const cleanPhone = p.cliente_tel.replace(/\D/g, ''); // keep only numbers
      contactoHtml = `
        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <a href="tel:${cleanPhone}" class="btn-action" style="flex:1; text-decoration:none; background:#e0f2fe; color:#0284c7; border:1.5px solid #bae6fd; text-align:center;">
            📞 Llamar
          </a>
          <a href="https://wa.me/${cleanPhone}?text=Hola!%20Soy%20el%20delivery%20de%20El%20Pechito,%20estoy%20llegando." target="_blank" rel="noopener" class="btn-action" style="flex:1; text-decoration:none; background:#dcfce7; color:#166534; border:1.5px solid #bbf7d0; text-align:center;">
            💬 WhatsApp
          </a>
        </div>
      `;
    }

    locationHtml = `
      <div style="font-weight:700;margin-bottom:4px">👤 Cliente: ${p.cliente_nombre || 'Cliente'}</div>
      <div class="order-row"><span class="label">📍</span><span class="val">${p.direccion || '—'}</span></div>
      ${p.entre_calles ? `<div class="order-row"><span class="label">↔️</span><span class="val">${p.entre_calles}</span></div>` : ''}
      ${
        linkCliente
          ? `<a href="${linkCliente}" target="_blank" rel="noopener" class="btn-action btn-cliente" style="display:block;text-align:center;text-decoration:none;margin-top:12px;margin-bottom:16px">🏠 Ver en GPS</a>`
          : `<p style="color:var(--text-muted);margin-top:8px;margin-bottom:16px">Sin GPS del cliente</p>`
      }
      ${contactoHtml}
    `;
    actionHtml = `
      <button class="btn-action btn-entregado" onclick="marcarEntregado('${p.id}')">
        ✅ Marcar como entregado
      </button>
      <button class="btn-action btn-danger" style="margin-top:12px;background:transparent;border:1px solid #ef4444;color:#ef4444" onclick="cancelarViaje('${p.id}', '${p.estado}')">
        🚨 Tuve una emergencia (Abortar entrega)
      </button>
    `;
  }

  container.innerHTML = `
    <div style="padding:16px">
      <div class="viaje-card">
        ${headerHtml}
        <hr style="border-top:1px solid #333;margin:16px 0">
        
        ${locationHtml}
        
        <hr style="border-top:1px solid #333;margin:16px 0">
        ${renderItems(p.items, isRetirado)}
        ${renderPaymentInfo(p)}

        <div style="margin-top:24px">
          ${actionHtml}
        </div>
      </div>
    </div>`;
}

// ── Tab Hoy ──────────────────────────────────────
async function loadHoy() {
  if (!myUserId) return;

  const hoy = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('pedidos')
    .select('id, monto_envio, monto_total, cliente_nombre, created_at, updated_at')
    .eq('estado', 'entregado')
    .eq('repartidor_id', myUserId)
    .gte('updated_at', hoy)
    .order('updated_at', { ascending: false });

  const total = data?.length || 0;
  const totalEnvios = data?.reduce((s, p) => s + Number(p.monto_envio), 0) || 0;

  document.getElementById('hoy-viajes').textContent = total;
  document.getElementById('trip-count').textContent = total;
  document.getElementById('hoy-ingresos').textContent = `$${fmt(totalEnvios)}`;

  const list = document.getElementById('hoy-list');
  if (!total) {
    list.innerHTML = `<div class="state-empty" style="padding:32px 20px"><p>Aún no completaste viajes hoy</p></div>`;
    return;
  }

  list.innerHTML = data
    .map(
      (p, i) => `
    <div class="hoy-card">
      <div>
        <div style="font-weight:700">Viaje #${total - i}</div>
        <div class="hoy-label">${p.cliente_nombre || '—'} · ${fmtHora(p.updated_at)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--green)">$${fmt(p.monto_envio)}</div>
        <div class="hoy-label">envío</div>
      </div>
    </div>`
    )
    .join('');
}

// ── Aceptar viaje (primer click gana) ────────────
window.aceptarViaje = async (pedidoId) => {
  const btn = event.currentTarget || event.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Tomando...';
  }

  // Hacemos el update directo verificando que no tenga repartidor
  const { data, error } = await supabase
    .from('pedidos')
    .update({
      repartidor_id: myUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
    .is('repartidor_id', null)
    .select()
    .maybeSingle();

  if (data && !error) {
    // Cambiar al tab Mi Viaje automáticamente
    await checkActiveTrip();
    switchTab('mi-viaje');
    await loadAll();
  } else {
    alert('⚡ Otro repartidor tomó ese viaje primero o ya no está disponible');
    await loadAll();
  }
};

// ── Marcar Retirado (Ir al cliente) ──────────────
window.marcarRetirado = async (pedidoId) => {
  const btn = event.currentTarget || event.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Actualizando...';
  }

  await supabase.from('pedidos').update({ estado: 'en_camino' }).eq('id', pedidoId);
  await checkActiveTrip();
  await loadAll();
};

// ── Marcar entregado ─────────────────────────────
window.marcarEntregado = async (pedidoId) => {
  if (!confirm('¿Confirmar entrega?')) return;

  await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedidoId);

  await loadAll();
  switchTab('hoy');
};

// ── Cancelar Viaje (Emergencia) ──────────────────
window.cancelarViaje = async (pedidoId, estadoActual) => {
  const motivo = prompt(
    '¿Motivo de cancelación? (Ej: Pinche rueda, problemas con la moto, etc.)\\n\\nAtención: Si ya habías retirado el pedido, DEBÉS devolverlo al local.'
  );
  if (motivo === null) return;

  if (!confirm('⚠️ ¿Seguro que querés abandonar este viaje? Se liberará para otro repartidor.'))
    return;

  const btn = event.currentTarget || event.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Cancelando...';
  }

  // Si ya lo había retirado ('en_camino'), vuelve a 'listo' para que otra moto lo busque en el local
  const nuevoEstado = estadoActual === 'en_camino' ? 'listo' : estadoActual;

  // Guardamos el registro en la columna notas
  const { data: p } = await supabase.from('pedidos').select('notas').eq('id', pedidoId).single();
  const oldNotas = p?.notas ? p.notas + '\\n' : '';
  const nuevasNotas =
    oldNotas + `[🚨 Moto ${myNombre} canceló el viaje: ${motivo || 'Sin motivo'}]`;

  await supabase
    .from('pedidos')
    .update({
      repartidor_id: null,
      estado: nuevoEstado,
      notas: nuevasNotas,
    })
    .eq('id', pedidoId);

  await checkActiveTrip();
  await loadAll();
  switchTab('radar');
};

// ── Tabs ─────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document
    .getElementById(`tab-btn-${name === 'mi-viaje' ? 'viaje' : name}`)
    ?.classList.add('active');
  document.getElementById(`tab-${name}`)?.classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Tab count badges ─────────────────────────────
function updateTabCount(id, count, isAlert) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  if (count > 0) {
    el.classList.remove('hidden');
    if (isAlert) el.classList.add('alert');
    else el.classList.remove('alert');
  } else {
    el.classList.add('hidden');
  }
}

// ── Helpers ──────────────────────────────────────
function countItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, i) => s + (i.qty || 1), 0);
}

/**
 * Genera el bloque HTML con el detalle de productos del pedido.
 * Si withCheck=true muestra checkboxes para que el repartidor controle la entrega.
 */
function renderItems(items, withCheck = false) {
  if (!Array.isArray(items) || !items.length) return '';
  const rows = items
    .map((item, idx) => {
      const nombre = item.nombre || item.name || '—';
      const qty = item.qty || 1;
      const precio =
        item.precio != null ? ` · $${Number(item.precio).toLocaleString('es-AR')}` : '';
      if (withCheck) {
        return `
          <label class="item-check-row">
            <input type="checkbox" class="item-cb" id="cb-${idx}" onchange="this.closest('.item-check-row').classList.toggle('checked', this.checked)">
            <span class="item-qty">${qty}×</span>
            <span class="item-name">${nombre}</span>
            <span class="item-price">${precio}</span>
          </label>`;
      }
      return `
        <div class="item-row">
          <span class="item-qty">${qty}×</span>
          <span class="item-name">${nombre}</span>
          <span class="item-price">${precio}</span>
        </div>`;
    })
    .join('');
  return `
    <div class="items-block">
      <div class="items-title">🛒 Productos del pedido</div>
      ${rows}
    </div>`;
}

/**
 * Genera el desglose claro de pagos para el repartidor
 */
function renderPaymentInfo(p) {
  if (p.metodo_pago === 'transferencia') {
    return `
      <div style="background:#1f2937; padding:12px; border-radius:8px; margin-top:16px; border-left:4px solid #3b82f6;">
        <div style="font-size:12px; font-weight:700; color:#9ca3af; margin-bottom:8px;">💳 PAGO POR TRANSFERENCIA</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px;">
          <span style="color:#9ca3af;">💸 Pagar al local:</span>
          <strong style="color:#9ca3af;">$0 (Ya pagado)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:16px;">
          <span style="color:#9ca3af;">💰 Cobrar al cliente:</span>
          <strong style="color:#9ca3af;">$0 (Ya pagado)</strong>
        </div>
      </div>
    `;
  } else {
    return `
      <div style="background:#1f2937; padding:12px; border-radius:8px; margin-top:16px; border-left:4px solid #10b981;">
        <div style="font-size:12px; font-weight:700; color:#10b981; margin-bottom:8px;">💵 PAGO EN EFECTIVO</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
          <span style="color:#e5e7eb;">💸 Pagar al local (Fondo):</span>
          <strong style="color:#ef4444;">$${fmt(p.monto_productos)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:18px;">
          <span style="color:#e5e7eb;">💰 Cobrar al cliente:</span>
          <strong style="color:#10b981;">$${fmt(p.monto_total)}</strong>
        </div>
      </div>
    `;
  }
}
