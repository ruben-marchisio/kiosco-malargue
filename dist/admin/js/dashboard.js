/* =============================================
   Kiosco Digital — Dashboard
   ============================================= */

import { supabase, fmt } from './supabase-client.js';
import { miComercio } from './admin.js';

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
}
