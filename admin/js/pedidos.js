/* =============================================
   Kiosco Digital — Pedidos (Admin)
   Pedidos web en tiempo real (tabla pedidos)
   ============================================= */

import { supabase, fmt } from './supabase-client.js';

let realtimeCh = null;

// ── Labels y colores por estado ────────────────
const ESTADOS = {
  pendiente: {
    label: '⏳ Pendiente',
    color: '#f59e0b',
    next: 'en_preparacion',
    nextLabel: '✅ Aceptar pedido',
  },
  en_preparacion: {
    label: '👨‍🍳 En preparación',
    color: '#3b82f6',
    next: 'listo',
    nextLabel: '✅ Listo para retirar',
  },
  listo: { label: '🟢 Listo para moto', color: '#10b981', next: null, nextLabel: null },
  en_camino: { label: '🏍️ En camino', color: '#8b5cf6', next: null, nextLabel: null },
  entregado: { label: '✅ Entregado', color: '#6b7280', next: null, nextLabel: null },
  cancelado: { label: '❌ Cancelado', color: '#ef4444', next: null, nextLabel: null },
};

// ── Formato hora ───────────────────────────────
const fmtHora = (iso) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

// ── Cargar pedidos web ─────────────────────────────
export async function loadPedidos() {
  await loadWebPedidos();
}

async function loadWebPedidos() {
  const list = document.getElementById('web-pedidos-list');
  if (!list) return;

  list.innerHTML = '<p class="table-placeholder">Cargando...</p>';

  const hoy = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre)')
    .gte('created_at', hoy)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data?.length) {
    list.innerHTML = '<p class="table-placeholder">No hay pedidos web registrados hoy</p>';
    updateWebCounter(0);
    return;
  }

  // Contador de pedidos activos (no entregados ni cancelados)
  const activos = data.filter((p) => !['entregado', 'cancelado'].includes(p.estado)).length;
  updateWebCounter(activos);

  list.innerHTML = data.map(renderWebPedidoCard).join('');

  // Listeners de botones de estado
  list.querySelectorAll('[data-avanzar]').forEach((btn) => {
    btn.addEventListener('click', () => avanzarEstado(btn.dataset.avanzar, btn.dataset.next));
  });
  list.querySelectorAll('[data-cancelar]').forEach((btn) => {
    btn.addEventListener('click', () => cancelarPedido(btn.dataset.cancelar));
  });
  list.querySelectorAll('[data-borrar]').forEach((btn) => {
    btn.addEventListener('click', () => borrarPedido(btn.dataset.borrar));
  });
}

function renderWebPedidoCard(p) {
  const st = ESTADOS[p.estado] || ESTADOS.pendiente;

  // Genera lista visual de items
  const itemsHtml =
    Array.isArray(p.items) && p.items.length
      ? p.items
          .map(
            (i) =>
              `<span class="pw-item-row"><span class="pw-item-qty">${i.qty || 1}×</span> ${i.nombre || '?'}${i.precio !== null && i.precio !== undefined ? ` <span class="pw-item-price">$${fmt(i.precio)}</span>` : ''}</span>`
          )
          .join('')
      : '<span style="color:var(--muted)">—</span>';

  const canAdvance = st.next !== null;
  const isActive = !['entregado', 'cancelado'].includes(p.estado);

  return `
  <div class="pedido-web-card ${p.estado}" style="border-left:4px solid ${st.color}">
    <div class="pw-header">
      <div>
        <span class="pw-hora">${fmtHora(p.created_at)} · ${p.comercios?.nombre || 'Local'}</span>
        <span class="pw-status" style="background:${st.color}20;color:${st.color}">${st.label}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="pw-total">$${fmt(p.monto_total)}</div>
        <button class="btn-pw-borrar" data-borrar="${p.id}" title="Borrar pedido">🗑️</button>
      </div>
    </div>
    <div class="pw-body">
      <div class="pw-row"><span class="pw-lbl">👤</span><span>${p.cliente_nombre || '—'}</span></div>
      <div class="pw-row"><span class="pw-lbl">📍</span><span>${p.direccion || '—'}${p.entre_calles ? ` · Entre: ${p.entre_calles}` : ''}</span></div>
      <div class="pw-row pw-row-items">
        <span class="pw-lbl">🛒</span>
        <div class="pw-items-list">${itemsHtml}</div>
      </div>
      <div class="pw-row">
        <span class="pw-lbl">${p.metodo_pago === 'transferencia' ? '💳' : '💵'}</span>
        <span>${p.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'} · Envío: $${fmt(p.monto_envio)}</span>
      </div>
      ${p.gps_lat ? `<div class="pw-row"><span class="pw-lbl">🗺️</span><a href="https://maps.google.com/?q=${p.gps_lat},${p.gps_lng}" target="_blank" rel="noopener" style="color:var(--primary)">Ver ubicación GPS</a></div>` : ''}
    </div>
    ${
      isActive
        ? `
    <div class="pw-actions">
      ${canAdvance ? `<button class="btn btn-primary btn-sm" data-avanzar="${p.id}" data-next="${st.next}">${st.nextLabel}</button>` : ''}
      ${p.estado === 'pendiente' ? `<button class="btn btn-danger btn-sm" data-cancelar="${p.id}">❌ Cancelar</button>` : ''}
    </div>`
        : ''
    }
  </div>`;
}

// ── Avanzar estado ─────────────────────────────
async function avanzarEstado(pedidoId, nuevoEstado) {
  await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedidoId);
  await loadWebPedidos();
}

async function cancelarPedido(pedidoId) {
  if (!confirm('¿Cancelar este pedido? No se cobrará comisión.')) return;
  await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedidoId);
  await loadWebPedidos();
}

async function borrarPedido(pedidoId) {
  if (!confirm('¿Borrar este pedido permanentemente? Esta acción no se puede deshacer.')) return;

  const { error } = await supabase.from('pedidos').delete().eq('id', pedidoId).select();

  if (error) {
    console.error('Error al borrar pedido:', error);
    alert(`Error: ${error.message}`);
    return;
  }

  await loadWebPedidos();
}

function updateWebCounter(n) {
  const el = document.getElementById('web-pedidos-count');
  if (el) el.textContent = n > 0 ? n : '—';
}

// ── Realtime ───────────────────────────────────────────
function subscribeRealtime() {
  if (realtimeCh) return;
  realtimeCh = supabase
    .channel('admin-pedidos-rt')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pedidos',
      },
      () => loadWebPedidos()
    )
    .subscribe();
}

// ── Init ───────────────────────────────────────────
export function initPedidos() {
  subscribeRealtime();
}
