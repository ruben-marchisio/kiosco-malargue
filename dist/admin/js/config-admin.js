/* =============================================
   Kiosco Digital — Configuración del comercio
   Cada comerciante gestiona su propio perfil:
   - Nombre, WhatsApp, horario, estado
   - Ubicación GPS del local
   SuperAdmin también puede abrir/cerrar su local
   ============================================= */

import { supabase } from './supabase-client.js';
import { miComercio } from './admin.js';

// ── DOM refs — estado del local ────────────────
const toggleInput = document.getElementById('c-abierto');
const toggleCard = document.getElementById('store-toggle-card');
const closeOptions = document.getElementById('store-close-options');
const toggleEmoji = document.getElementById('store-toggle-emoji');
const toggleLabel = document.getElementById('store-toggle-label');
const toggleSub = document.getElementById('store-toggle-sub');
const templateBtns = document.querySelectorAll('.template-btn');
const horaInput = document.getElementById('c-hora-reap');
const mensajeInput = document.getElementById('c-mensaje-cierre');

let motivoActivo = 'horario';

// ── UI del toggle ──────────────────────────────
function updatePanelUI(abierto) {
  if (abierto) {
    toggleCard.classList.remove('is-closed');
    toggleEmoji.textContent = '🟢';
    toggleLabel.textContent = 'Local abierto';
    toggleSub.textContent = 'Los clientes pueden realizar pedidos';
    closeOptions.classList.remove('show');
  } else {
    toggleCard.classList.add('is-closed');
    toggleEmoji.textContent = '🔴';
    toggleLabel.textContent = 'Local cerrado temporalmente';
    toggleSub.textContent = 'Los pedidos por WhatsApp están bloqueados';
    closeOptions.classList.add('show');
  }
}

// ── Plantillas de cierre ───────────────────────
templateBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    templateBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    motivoActivo = btn.dataset.motivo;
    if (btn.dataset.msg) mensajeInput.value = btn.dataset.msg;
    else mensajeInput.value = '';
  });
});

// ── Toggle apertura/cierre ─────────────────────
toggleInput.addEventListener('change', async () => {
  const abierto = toggleInput.checked;
  updatePanelUI(abierto);

  if (miComercio) {
    // COMERCIO: solo actualiza SU propia fila en la tabla comercios.
    // NUNCA toca config_negocio — eso es exclusivo del admin principal.
    await supabase
      .from('comercios')
      .update({
        abierto,
        motivo_cierre: abierto ? null : motivoActivo,
        mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
        hora_reapertura: abierto ? null : horaInput.value || null,
      })
      .eq('id', miComercio.id);
  } else {
    // ADMIN PRINCIPAL: actualiza config_negocio (afecta al badge global de El Pechito)
    await supabase
      .from('config_negocio')
      .update({
        abierto,
        motivo_cierre: abierto ? null : motivoActivo,
        mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
        hora_reapertura: abierto ? null : horaInput.value || null,
      })
      .eq('id', 1);
  }
});

// ── Cargar config ──────────────────────────────
export async function loadConfig() {
  if (miComercio) {
    // COMERCIO: leer su estado directamente de la tabla comercios.
    // NO leer config_negocio — ese es el estado de El Pechito.
    const { data: com } = await supabase
      .from('comercios')
      .select('*')
      .eq('id', miComercio.id)
      .single();

    const fuente = com || miComercio; // fallback al objeto cargado en login
    const abierto = fuente.abierto ?? true;
    toggleInput.checked = abierto;
    updatePanelUI(abierto);

    if (!abierto) {
      motivoActivo = fuente.motivo_cierre || 'horario';
      templateBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.motivo === motivoActivo);
      });
      mensajeInput.value = fuente.mensaje_cierre || '';
      horaInput.value = fuente.hora_reapertura || '';
    } else {
      // Reset motivo si está abierto
      templateBtns.forEach((btn) => btn.classList.remove('active'));
      mensajeInput.value = '';
      horaInput.value = '';
    }

    document.getElementById('c-nombre').value = fuente.nombre || '';
    document.getElementById('c-wa').value = fuente.whatsapp || '';
    document.getElementById('c-rubro').value = fuente.rubro || 'kiosco';

    if (fuente.coords_lat && fuente.coords_lng) {
      const hint = document.getElementById('c-gps-hint');
      if (hint)
        hint.textContent = `📍 ${fuente.coords_lat.toFixed(5)}, ${fuente.coords_lng.toFixed(5)}`;
    }
  } else {
    // ADMIN PRINCIPAL: leer de config_negocio
    const { data: cfg } = await supabase.from('config_negocio').select('*').eq('id', 1).single();

    if (cfg) {
      const abierto = cfg.abierto ?? true;
      toggleInput.checked = abierto;
      updatePanelUI(abierto);
      if (!abierto) {
        motivoActivo = cfg.motivo_cierre || 'horario';
        templateBtns.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.motivo === motivoActivo);
        });
        mensajeInput.value = cfg.mensaje_cierre || '';
        horaInput.value = cfg.hora_reapertura || '';
      }
      document.getElementById('c-nombre').value = cfg.nombre_negocio || '';
      document.getElementById('c-wa').value = cfg.whatsapp_numero || '';
      document.getElementById('c-envio').value = cfg.precio_envio || 3000;
    }

    // Show DB Tools only for superadmin
    const dbTools = document.getElementById('card-db-tools');
    if (dbTools) dbTools.style.display = 'block';
  }
}

// ── Guardar config ─────────────────────────────
export function initConfig() {
  const configForm = document.getElementById('config-form');
  const gpsBtn = document.getElementById('c-gps-btn');
  const gpsHint = document.getElementById('c-gps-hint');
  let newCoords = null;

  // Botón GPS: capturar ubicación del local
  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        gpsHint.textContent = 'GPS no disponible en este dispositivo';
        return;
      }
      gpsBtn.textContent = '⏳ Obteniendo...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          gpsBtn.textContent = '✅ Ubicación actualizada';
          gpsBtn.style.background = 'var(--success)';
          if (gpsHint)
            gpsHint.textContent = `📍 ${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`;
        },
        () => {
          gpsBtn.textContent = '❌ Error de GPS';
        },
        { timeout: 10000 }
      );
    });
  }

  const btnCleanDb = document.getElementById('btn-clean-db');
  if (btnCleanDb && !miComercio) {
    btnCleanDb.addEventListener('click', async () => {
      if (
        !confirm(
          '⚠️ ¿Estás seguro que querés purgar la base de datos?\\n\\nSe borrarán permanentemente los pedidos que tengan más de 30 días de antigüedad y que ya estén liquidados o cancelados.\\n\\nLas liquidaciones históricas (dinero cobrado/pagado) NO se borrarán, solo se borrará el detalle individual del pedido.'
        )
      ) {
        return;
      }

      btnCleanDb.textContent = '⏳ Limpiando...';
      btnCleanDb.disabled = true;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const limitDate = thirtyDaysAgo.toISOString();

      try {
        // We delete in two passes due to or/and complexity in supabase js client
        // 1. Delete old cancelled orders
        const { count: countCancel, error: err1 } = await supabase
          .from('pedidos')
          .delete({ count: 'exact' })
          .eq('estado', 'cancelado')
          .lt('created_at', limitDate);

        if (err1) throw err1;

        // 2. Delete old delivered orders that are fully liquidated
        const { count: countEnt, error: err2 } = await supabase
          .from('pedidos')
          .delete({ count: 'exact' })
          .eq('estado', 'entregado')
          .lt('created_at', limitDate)
          .not('liquidacion_comercio_id', 'is', null)
          .not('liquidacion_moto_id', 'is', null);

        if (err2) throw err2;

        const totalDeleted = (countCancel || 0) + (countEnt || 0);
        alert(
          `✅ Limpieza completada con éxito.\\nSe eliminaron ${totalDeleted} pedidos antiguos de la base de datos para liberar espacio.`
        );
      } catch (error) {
        console.error('Error cleaning DB:', error);
        alert('❌ Ocurrió un error al limpiar la base de datos: ' + error.message);
      } finally {
        btnCleanDb.textContent = '🧹 Borrar pedidos de más de 30 días';
        btnCleanDb.disabled = false;
      }
    });
  }

  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('c-nombre').value.trim();
    const whatsapp = document.getElementById('c-wa').value.trim();
    const rubro = document.getElementById('c-rubro')?.value || 'kiosco';
    const abierto = toggleInput.checked;

    if (miComercio) {
      // Guardar en la tabla comercios (incluye estado abierto/cerrado)
      const updates = {
        nombre,
        whatsapp,
        rubro,
        abierto,
        motivo_cierre: abierto ? null : motivoActivo,
        mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
        hora_reapertura: abierto ? null : horaInput.value || null,
      };
      if (newCoords) {
        updates.coords_lat = newCoords.lat;
        updates.coords_lng = newCoords.lng;
      }
      await supabase.from('comercios').update(updates).eq('id', miComercio.id);

      // También sincronizar el WhatsApp del local principal en config_negocio
      // (solo si es el comercio principal / superadmin)
    } else {
      // Superadmin sin comercio: guardar en config_negocio
      const precio_envio = parseFloat(document.getElementById('c-envio')?.value || 3000);
      await supabase
        .from('config_negocio')
        .update({
          nombre_negocio: nombre,
          whatsapp_numero: whatsapp,
          precio_envio,
          abierto,
          motivo_cierre: abierto ? null : motivoActivo,
          mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
          hora_reapertura: abierto ? null : horaInput.value || null,
        })
        .eq('id', 1);
    }

    alert('✅ Configuración guardada');
  });
}
