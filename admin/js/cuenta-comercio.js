/* =============================================
   Kiosco Digital — Mi Cuenta (rol: comercio)
   Muestra el saldo pendiente que el comercio
   debe pagar al admin (envíos + comisión 10%)
   y el historial de liquidaciones anteriores.
   ============================================= */

import { supabase } from './supabase-client.js';
import { miComercio } from './admin.js';

const fmt = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

// ── Cargar todo ─────────────────────────────────
export async function loadCuentaComercio() {
  await Promise.all([loadSaldoPendiente(), loadHistorialLiquidaciones()]);
}

// ── Saldo pendiente ──────────────────────────────
async function loadSaldoPendiente() {
  const wrap = document.getElementById('mi-cuenta-pendiente');
  if (!wrap || !miComercio) return;
  wrap.innerHTML = '<p class="table-placeholder">Calculando saldo...</p>';

  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('monto_envio, monto_productos')
    .eq('comercio_id', miComercio.id)
    .eq('estado', 'entregado')
    .is('liquidacion_comercio_id', null);

  if (error) {
    wrap.innerHTML = `<p class="table-placeholder">Error: ${error.message}</p>`;
    return;
  }

  if (!pedidos?.length) {
    wrap.innerHTML = `
      <div class="mi-cuenta-ok">
        <div class="mi-cuenta-ok-icon">✅</div>
        <div class="mi-cuenta-ok-text">Estás al día — no tenés saldo pendiente</div>
      </div>`;
    return;
  }

  const totalEnvios = pedidos.reduce((s, p) => s + Number(p.monto_envio), 0);
  const totalProductos = pedidos.reduce((s, p) => s + Number(p.monto_productos || 0), 0);
  const comision = +(totalProductos * 0.1).toFixed(2);
  const totalAPagar = totalEnvios + comision;
  const viajes = pedidos.length;

  wrap.innerHTML = `
    <div class="mi-cuenta-resumen">
      <div class="mi-cuenta-alerta">⏳ Tenés saldo pendiente</div>

      <div class="mi-cuenta-desglose">
        <div class="mi-cuenta-fila">
          <span>🏍️ Delivery (${viajes} viaje${viajes !== 1 ? 's' : ''})</span>
          <span>$${fmt(totalEnvios)}</span>
        </div>
        <div class="mi-cuenta-fila">
          <span>📊 Ventas realizadas</span>
          <span>$${fmt(totalProductos)}</span>
        </div>
        <div class="mi-cuenta-fila comision">
          <span>💼 Comisión plataforma (10% ventas)</span>
          <span>$${fmt(comision)}</span>
        </div>
        <div class="mi-cuenta-fila total">
          <span>Total a abonar</span>
          <span>$${fmt(totalAPagar)}</span>
        </div>
      </div>

      <div class="mi-cuenta-aviso">
        El administrador confirmará el pago una vez que lo reciba.
      </div>
    </div>`;
}

// ── Historial de liquidaciones ───────────────────
async function loadHistorialLiquidaciones() {
  const wrap = document.getElementById('mi-cuenta-historial');
  if (!wrap || !miComercio) return;
  wrap.innerHTML = '<p class="table-placeholder">Cargando historial...</p>';

  const { data, error } = await supabase
    .from('liquidaciones')
    .select('monto, detalle, created_at')
    .eq('tipo', 'comercio')
    .eq('entidad_id', miComercio.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    wrap.innerHTML = '<p class="table-placeholder">Sin liquidaciones anteriores</p>';
    return;
  }

  const fmtFecha = (iso) =>
    new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  wrap.innerHTML = data
    .map(
      (liq) => `
    <div class="liq-hist-item">
      <div class="liq-hist-info">
        <div class="liq-hist-fecha">✅ Pagado · ${fmtFecha(liq.created_at)}</div>
        <div class="liq-hist-detalle">
          ${liq.detalle?.viajes ? `${liq.detalle.viajes} viaje${liq.detalle.viajes !== 1 ? 's' : ''}` : ''}
          ${liq.detalle?.comision_app ? ` · Comisión: $${fmt(liq.detalle.comision_app)}` : ''}
        </div>
      </div>
      <div class="liq-hist-monto">$${fmt(liq.monto)}</div>
    </div>`
    )
    .join('');
}

export function initCuentaComercio() {
  // No hay eventos extra por ahora
}
