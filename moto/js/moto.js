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

// ── Cargar todo ─────────────────────────────────
async function loadAll() {
  await Promise.all([loadRadar(), loadDisponibles(), loadMiViaje(), loadHoy()]);
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
  const { data } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre, coords_lat, coords_lng)')
    .eq('estado', 'en_preparacion')
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
      ${
        p.comercios?.coords_lat
          ? `
        <a href="https://maps.google.com/?q=${p.comercios.coords_lat},${p.comercios.coords_lng}"
           target="_blank" rel="noopener" class="btn-action btn-local" style="display:block;text-align:center;text-decoration:none;margin-top:10px">
           📍 Ver local en mapa
        </a>`
          : ''
      }
    </div>`
    )
    .join('');
}

// ── Tab Disponibles (Listo para retirar) ──────────
async function loadDisponibles() {
  const { data } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre, coords_lat, coords_lng)')
    .eq('estado', 'listo')
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
      <div class="order-amount">$${fmt(p.monto_total)}</div>
      <div class="order-pago">${p.metodo_pago === 'transferencia' ? '💳 Pagado por transferencia' : '💵 Cobrar en destino'}</div>
      <button class="btn-action btn-tomar" onclick="aceptarViaje('${p.id}')">
        🏍️ Tomar este viaje
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
    .eq('estado', 'en_camino')
    .eq('repartidor_id', myUserId)
    .maybeSingle();

  const container = document.getElementById('viaje-content');

  if (!p) {
    container.innerHTML = `<div class="state-empty"><div class="icon">🛵</div><p>No tenés un viaje activo</p></div>`;
    return;
  }

  const linkLocal = p.comercios?.coords_lat
    ? `https://maps.google.com/?q=${p.comercios.coords_lat},${p.comercios.coords_lng}`
    : null;
  const linkCliente =
    p.gps_lat && p.gps_lng ? `https://maps.google.com/?q=${p.gps_lat},${p.gps_lng}` : null;

  container.innerHTML = `
    <div style="padding:16px">
      <div class="viaje-card">
        <div class="viaje-title">🏍️ Viaje en curso</div>
        <div class="viaje-cliente">👤 ${p.cliente_nombre || 'Cliente'}</div>
        <div class="order-row"><span class="label">📍</span><span class="val">${p.direccion || '—'}</span></div>
        ${p.entre_calles ? `<div class="order-row"><span class="label">↔️</span><span class="val">${p.entre_calles}</span></div>` : ''}
        ${renderItems(p.items, true)}
        <div class="viaje-monto">$${fmt(p.monto_total)}</div>
        <div class="order-pago">${p.metodo_pago === 'transferencia' ? '💳 Ya pagó por transferencia' : '💵 Cobrar en destino'}</div>

        <div class="btn-row">
          ${
            linkLocal
              ? `<a href="${linkLocal}" target="_blank" rel="noopener" class="btn-action btn-local" style="flex:1;display:block;text-align:center;text-decoration:none">📍 Ir al local</a>`
              : `<button class="btn-action btn-disabled" style="flex:1" disabled>📍 Sin coords local</button>`
          }
          ${
            linkCliente
              ? `<a href="${linkCliente}" target="_blank" rel="noopener" class="btn-action btn-cliente" style="flex:1;display:block;text-align:center;text-decoration:none">🏠 Ir al cliente</a>`
              : `<button class="btn-action btn-disabled" style="flex:1" disabled>🏠 Sin GPS cliente</button>`
          }
        </div>
        <button class="btn-action btn-entregado" onclick="marcarEntregado('${p.id}')">
          ✅ Marcar como entregado
        </button>
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

  // Hacemos el update directo verificando que siga en estado "listo"
  const { data, error } = await supabase
    .from('pedidos')
    .update({
      estado: 'en_camino',
      repartidor_id: myUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
    .eq('estado', 'listo')
    .select()
    .maybeSingle();

  if (data && !error) {
    // Cambiar al tab Mi Viaje automáticamente
    switchTab('mi-viaje');
  } else {
    alert('⚡ Otro repartidor tomó ese viaje primero o ya no está disponible');
    await loadDisponibles();
  }
};

// ── Marcar entregado ─────────────────────────────
window.marcarEntregado = async (pedidoId) => {
  if (!confirm('¿Confirmar entrega?')) return;

  await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedidoId);

  await loadAll();
  switchTab('hoy');
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
