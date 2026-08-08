/* =============================================
   Kiosco Digital — Dashboard
   ============================================= */

import { supabase, fmt } from './supabase-client.js';

export async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];

  const [{ data: prods }, { data: pedidos }] = await Promise.all([
    supabase.from('productos').select('id,disponible'),
    supabase
      .from('pedidos_log')
      .select('monto_total,monto_envio,monto_comision,created_at')
      .gte('created_at', today),
  ]);

  const totalProds = prods?.length || 0;
  const disponibles = prods?.filter((p) => p.disponible).length || 0;
  const ventaHoy = pedidos?.reduce((s, p) => s + Number(p.monto_total), 0) || 0;
  const enviosHoy = pedidos?.reduce((s, p) => s + Number(p.monto_envio), 0) || 0;
  const comisionHoy = pedidos?.reduce((s, p) => s + Number(p.monto_comision), 0) || 0;

  document.getElementById('stat-prods').textContent = totalProds;
  document.getElementById('stat-activos').textContent = disponibles;
  document.getElementById('stat-venta').textContent = `$${fmt(ventaHoy)}`;
  document.getElementById('stat-envios').textContent = `$${fmt(enviosHoy)}`;
  document.getElementById('stat-comision').textContent = `$${fmt(comisionHoy)}`;
  document.getElementById('stat-pedidos').textContent = pedidos?.length || 0;
}
