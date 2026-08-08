/* =============================================
   Kiosco Digital — Pedidos
   ============================================= */

import { supabase, fmt } from './supabase-client.js';

export async function loadPedidos() {
  const list = document.getElementById('pedidos-list');
  list.innerHTML = '<p class="table-placeholder">Cargando...</p>';

  const { data } = await supabase
    .from('pedidos_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data?.length) {
    list.innerHTML = '<p class="table-placeholder">Aún no hay pedidos registrados</p>';
    return;
  }

  list.innerHTML = data
    .map((p) => {
      const d = new Date(p.created_at);
      const hora = d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      return `
      <div class="log-item">
        <div class="log-icon">${p.es_delivery ? '🚴' : '🏪'}</div>
        <div class="log-info">
          <div class="log-time">${fecha} · ${hora}</div>
          <div class="log-desc">${p.notas || (p.es_delivery ? 'Delivery' : 'Retiro en local')}${p.monto_comision > 0 ? ` · Comisión: $${fmt(p.monto_comision)}` : ''}</div>
        </div>
        <div class="log-total">$${fmt(p.monto_total)}</div>
      </div>`;
    })
    .join('');
}

export function initPedidos() {
  const pedidoForm = document.getElementById('pedido-form');
  pedidoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const monto_total = parseFloat(document.getElementById('p-total').value);
    const monto_envio = parseFloat(document.getElementById('p-envio').value || 0);
    const es_delivery = document.getElementById('p-delivery').checked;
    const es_tercero = document.getElementById('p-comision').checked;
    const notas = document.getElementById('p-notas').value.trim();
    const monto_comision = es_tercero ? +(monto_total * 0.1).toFixed(2) : 0;

    await supabase
      .from('pedidos_log')
      .insert({ monto_total, monto_envio, es_delivery, monto_comision, notas });

    pedidoForm.reset();
    document.getElementById('p-delivery').checked = true;
    await loadPedidos();
  });
}
