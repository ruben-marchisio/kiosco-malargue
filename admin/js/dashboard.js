/* =============================================
   Kiosco Digital — Dashboard
   ============================================= */

import { supabase, fmt } from './supabase-client.js';
import { miComercio } from './admin.js';

let motosRealtimeCh = null;

export async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];

  let queryProds = supabase.from('productos').select('id,disponible');
  if (miComercio) {
    queryProds = queryProds.eq('comercio_id', miComercio.id);
  }

  let queryPedidos = supabase
    .from('pedidos')
    .select('estado, monto_total, monto_envio, monto_comision, comercio_id, comercios(nombre)')
    .gte('created_at', today);

  if (miComercio) {
    queryPedidos = queryPedidos.eq('comercio_id', miComercio.id);
  }

  const [{ data: prods }, { data: pedidos }] = await Promise.all([queryProds, queryPedidos]);

  const totalProds = prods?.length || 0;
  const disponibles = prods?.filter((p) => p.disponible).length || 0;

  const entregados = pedidos?.filter((p) => p.estado === 'entregado') || [];

  const ventaHoy = entregados.reduce((s, p) => s + Number(p.monto_total), 0);
  const enviosHoy = entregados.reduce((s, p) => s + Number(p.monto_envio || 0), 0);
  const comisionHoy = entregados.reduce((s, p) => s + Number(p.monto_comision || 0), 0);

  document.getElementById('stat-prods').textContent = totalProds;
  document.getElementById('stat-activos').textContent = disponibles;
  document.getElementById('stat-venta').textContent = `$${fmt(ventaHoy)}`;
  document.getElementById('stat-envios').textContent = `$${fmt(enviosHoy)}`;
  document.getElementById('stat-comision').textContent = `$${fmt(comisionHoy)}`;
  document.getElementById('stat-pedidos').textContent = entregados.length;

  // Alertas de cancelaciones (sólo Admin principal)
  const alertCard = document.getElementById('alert-cancelaciones-card');
  const alertList = document.getElementById('alert-cancelaciones-list');

  if (!miComercio && alertCard && alertList && pedidos) {
    const cancelados = pedidos.filter((p) => p.estado === 'cancelado');
    if (cancelados.length > 0) {
      const counts = {};
      cancelados.forEach((p) => {
        const name = p.comercios?.nombre || 'Desconocido';
        counts[name] = (counts[name] || 0) + 1;
      });

      let html = '';
      for (const [name, count] of Object.entries(counts)) {
        if (count >= 3) {
          html += `<div style="margin-bottom: 8px; color: #b91c1c; font-weight: 600;">🚨 ${name}: ${count} pedidos cancelados hoy</div>`;
        } else {
          html += `<div style="margin-bottom: 8px; color: #b45309;">🔸 ${name}: ${count} pedidos cancelados hoy</div>`;
        }
      }
      alertList.innerHTML = html;
      alertCard.style.display = 'block';
    } else {
      alertCard.style.display = 'none';
    }
  }

  // Widget de motos (solo admin)
  if (!miComercio) {
    await loadMotasWidget();
    subscribeMotasRealtime();
  }
}

// ── Widget motos en línea ──────────────────────
async function loadMotasWidget() {
  const container = document.getElementById('widget-motos');
  if (!container) return;

  const { data: motos } = await supabase
    .from('repartidores')
    .select('id, nombre, vehiculo, en_linea, activo')
    .eq('activo', true)
    .order('nombre');

  if (!motos || motos.length === 0) {
    container.innerHTML = `<p style="color:#6b7280; font-size:14px;">No hay repartidores registrados aún.</p>`;
    return;
  }

  const enLinea = motos.filter((m) => m.en_linea);
  const offline = motos.filter((m) => !m.en_linea);

  container.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap">
      <span style="background:#d1fae5; color:#065f46; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700">
        🟢 ${enLinea.length} disponible${enLinea.length !== 1 ? 's' : ''}
      </span>
      <span style="background:#fee2e2; color:#991b1b; padding:4px 12px; border-radius:20px; font-size:13px; font-weight:700">
        🔴 ${offline.length} fuera de línea
      </span>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px">
      ${motos
        .map(
          (m) => `
        <div style="
          display:flex; align-items:center; gap:10px;
          padding:10px 14px;
          background: ${m.en_linea ? '#f0fdf4' : '#fafafa'};
          border: 1px solid ${m.en_linea ? '#86efac' : '#e5e7eb'};
          border-radius:10px;
        ">
          <span style="font-size:22px">${m.en_linea ? '🟢' : '⚫'}</span>
          <div style="flex:1">
            <div style="font-weight:700; font-size:14px">${m.nombre}</div>
            <div style="font-size:12px; color:#6b7280">${m.vehiculo || 'Moto'}</div>
          </div>
          <span style="
            font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px;
            background: ${m.en_linea ? '#dcfce7' : '#f3f4f6'};
            color: ${m.en_linea ? '#166534' : '#6b7280'};
          ">${m.en_linea ? 'Disponible' : 'Fuera de línea'}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function subscribeMotasRealtime() {
  if (motosRealtimeCh) return; // ya suscripto
  motosRealtimeCh = supabase
    .channel('admin-motos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'repartidores' }, () =>
      loadMotasWidget()
    )
    .subscribe();
}
