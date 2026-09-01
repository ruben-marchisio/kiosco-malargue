/* =============================================
   Kiosco Digital — Liquidaciones (Admin)
   Solo visible para rol 'admin'
   - Tab Motos: pagar envíos a repartidores
   - Tab Comercios: cobrar envíos + 10% comisión
   ============================================= */

import { supabase } from './supabase-client.js';

const fmt = (n) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

// ── Cargar todo ─────────────────────────────────
export async function loadLiquidaciones() {
  await Promise.all([loadResumenMotos(), loadResumenComercios()]);
}

// ── TAB MOTOS ────────────────────────────────────
async function loadResumenMotos() {
  const list = document.getElementById('liq-motos-list');
  if (!list) return;
  list.innerHTML = '<p class="table-placeholder">Cargando...</p>';

  // 1. Pedidos entregados sin liquidar (repartidor_id = auth.users.id del repartidor)
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('repartidor_id, monto_envio')
    .eq('estado', 'entregado')
    .is('liquidacion_id', null)
    .not('repartidor_id', 'is', null);

  if (error) {
    list.innerHTML = `<p class="table-placeholder">Error: ${error.message}</p>`;
    return;
  }

  if (!pedidos?.length) {
    list.innerHTML = '<div class="liq-empty">✅ No hay viajes pendientes de pago</div>';
    return;
  }

  // 2. Obtener nombres de repartidores (user_id = auth.users.id = pedidos.repartidor_id)
  const userIds = [...new Set(pedidos.map((p) => p.repartidor_id))];
  const { data: repartidores } = await supabase
    .from('repartidores')
    .select('user_id, id, nombre')
    .in('user_id', userIds);

  const repMap = {};
  (repartidores || []).forEach((r) => {
    repMap[r.user_id] = { id: r.id, nombre: r.nombre };
  });

  // 3. Agrupar por repartidor
  const grupos = {};
  pedidos.forEach((p) => {
    const rep = repMap[p.repartidor_id];
    const key = p.repartidor_id;
    if (!grupos[key]) {
      grupos[key] = {
        userId: p.repartidor_id,
        repId: rep?.id || p.repartidor_id,
        nombre: rep?.nombre || `Repartidor (${p.repartidor_id.slice(0, 6)})`,
        viajes: 0,
        total: 0,
      };
    }
    grupos[key].viajes++;
    grupos[key].total += Number(p.monto_envio);
  });

  const items = Object.values(grupos);

  list.innerHTML = items
    .map(
      (rep) => `
    <div class="liq-card">
      <div class="liq-info">
        <div class="liq-nombre">🏍️ ${rep.nombre}</div>
        <div class="liq-detalle">${rep.viajes} viaje${rep.viajes !== 1 ? 's' : ''} entregado${rep.viajes !== 1 ? 's' : ''}</div>
      </div>
      <div class="liq-monto-wrap">
        <div class="liq-monto">$${fmt(rep.total)}</div>
        <div class="liq-sub">a pagarle</div>
      </div>
      <button class="btn-liq btn-liq-pagar"
        data-user-id="${rep.userId}"
        data-rep-id="${rep.repId}"
        data-nombre="${rep.nombre}"
        data-monto="${rep.total}"
        data-viajes="${rep.viajes}">
        💳 Liquidar
      </button>
    </div>`
    )
    .join('');

  list.querySelectorAll('.btn-liq-pagar').forEach((btn) => {
    btn.addEventListener('click', () =>
      liquidarMoto({
        userId: btn.dataset.userId,
        repId: btn.dataset.repId,
        nombre: btn.dataset.nombre,
        monto: Number(btn.dataset.monto),
        viajes: Number(btn.dataset.viajes),
      })
    );
  });
}

// ── TAB COMERCIOS ────────────────────────────────
async function loadResumenComercios() {
  const list = document.getElementById('liq-comercios-list');
  if (!list) return;
  list.innerHTML = '<p class="table-placeholder">Cargando...</p>';

  // Pedidos entregados sin liquidar, con datos del comercio
  const { data, error } = await supabase
    .from('pedidos')
    .select('comercio_id, monto_envio, monto_productos, comercios(id, nombre)')
    .eq('estado', 'entregado')
    .is('liquidacion_id', null)
    .not('comercio_id', 'is', null);

  if (error) {
    list.innerHTML = `<p class="table-placeholder">Error: ${error.message}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<div class="liq-empty">✅ No hay comercios con saldo pendiente</div>';
    return;
  }

  // Agrupar por comercio
  const grupos = {};
  data.forEach((p) => {
    const com = p.comercios;
    if (!com) return;
    if (!grupos[com.id]) {
      grupos[com.id] = { id: com.id, nombre: com.nombre, viajes: 0, envios: 0, productos: 0 };
    }
    grupos[com.id].viajes++;
    grupos[com.id].envios += Number(p.monto_envio);
    grupos[com.id].productos += Number(p.monto_productos || 0);
  });

  const items = Object.values(grupos);
  if (!items.length) {
    list.innerHTML = '<div class="liq-empty">✅ No hay comercios con saldo pendiente</div>';
    return;
  }

  list.innerHTML = items
    .map((com) => {
      const comision = +(com.productos * 0.1).toFixed(2);
      const totalACobrar = com.envios + comision;
      return `
    <div class="liq-card">
      <div class="liq-info">
        <div class="liq-nombre">🏪 ${com.nombre}</div>
        <div class="liq-detalle">${com.viajes} viaje${com.viajes !== 1 ? 's' : ''} · Envíos: $${fmt(com.envios)}</div>
        <div class="liq-detalle">Ventas: $${fmt(com.productos)} → Comisión 10%: $${fmt(comision)}</div>
      </div>
      <div class="liq-monto-wrap">
        <div class="liq-monto">$${fmt(totalACobrar)}</div>
        <div class="liq-sub">a cobrarle</div>
      </div>
      <button class="btn-liq btn-liq-cobrar"
        data-com-id="${com.id}"
        data-nombre="${com.nombre}"
        data-envios="${com.envios}"
        data-productos="${com.productos}"
        data-comision="${comision}"
        data-total="${totalACobrar}"
        data-viajes="${com.viajes}">
        ✅ Cobrado
      </button>
    </div>`;
    })
    .join('');

  list.querySelectorAll('.btn-liq-cobrar').forEach((btn) => {
    btn.addEventListener('click', () =>
      liquidarComercio({
        comId: btn.dataset.comId,
        nombre: btn.dataset.nombre,
        envios: Number(btn.dataset.envios),
        productos: Number(btn.dataset.productos),
        comision: Number(btn.dataset.comision),
        total: Number(btn.dataset.total),
        viajes: Number(btn.dataset.viajes),
      })
    );
  });
}

// ── Liquidar moto ────────────────────────────────
async function liquidarMoto({ userId, repId, nombre, monto, viajes }) {
  if (
    !confirm(
      `¿Confirmás que pagaste $${fmt(monto)} a ${nombre} por ${viajes} viaje${viajes !== 1 ? 's' : ''}?`
    )
  )
    return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 1. Crear registro de liquidación (entidad_id = repartidores.id)
  const { data: liq, error: errLiq } = await supabase
    .from('liquidaciones')
    .insert({
      tipo: 'moto',
      entidad_id: repId,
      monto,
      detalle: { viajes, monto_envios: monto },
      creado_por: session?.user?.id,
    })
    .select()
    .single();

  if (errLiq) {
    alert(`Error al crear liquidación: ${errLiq.message}`);
    return;
  }

  // 2. Marcar pedidos como liquidados (repartidor_id = auth.users.id del repartidor = userId)
  const { error: errUpd } = await supabase
    .from('pedidos')
    .update({ liquidacion_id: liq.id })
    .eq('estado', 'entregado')
    .is('liquidacion_id', null)
    .eq('repartidor_id', userId);

  if (errUpd) {
    console.warn('Advertencia al actualizar pedidos:', errUpd);
  }

  await loadResumenMotos();
}

// ── Liquidar comercio ────────────────────────────
async function liquidarComercio({ comId, nombre, envios, productos, comision, total, viajes }) {
  if (
    !confirm(
      `¿Confirmás que cobró ${nombre}?\n\n` +
        `Envíos: $${fmt(envios)}\n` +
        `Comisión 10% (ventas $${fmt(productos)}): $${fmt(comision)}\n` +
        `─────────────────\n` +
        `Total cobrado: $${fmt(total)}`
    )
  )
    return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 1. Crear liquidación
  const { data: liq, error: errLiq } = await supabase
    .from('liquidaciones')
    .insert({
      tipo: 'comercio',
      entidad_id: comId,
      monto: total,
      detalle: { viajes, monto_envios: envios, monto_productos: productos, comision_app: comision },
      creado_por: session?.user?.id,
    })
    .select()
    .single();

  if (errLiq) {
    alert(`Error al crear liquidación: ${errLiq.message}`);
    return;
  }

  // 2. Marcar pedidos del comercio como liquidados
  await supabase
    .from('pedidos')
    .update({ liquidacion_id: liq.id })
    .eq('estado', 'entregado')
    .is('liquidacion_id', null)
    .eq('comercio_id', comId);

  await loadResumenComercios();
}

// ── Tabs internos ────────────────────────────────
export function initLiquidaciones() {
  document.querySelectorAll('.liq-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.liq-tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.liq-tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`liq-panel-${btn.dataset.liqTab}`)?.classList.add('active');
    });
  });
}
