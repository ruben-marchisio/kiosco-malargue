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

  // Guardar en config_negocio (local principal Ruben) o en comercios (terceros)
  if (miComercio) {
    await supabase
      .from('comercios')
      .update({
        // Los campos de estado del local van en config_negocio para El Pechito
        // Para otros comercios podés agregar columna 'abierto' a la tabla comercios
      })
      .eq('id', miComercio.id);
  }

  // config_negocio siempre se actualiza (para el catálogo público)
  await supabase
    .from('config_negocio')
    .update({
      abierto,
      motivo_cierre: abierto ? null : motivoActivo,
      mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
      hora_reapertura: abierto ? null : horaInput.value || null,
    })
    .eq('id', 1);
});

// ── Cargar config ──────────────────────────────
export async function loadConfig() {
  // 1. Estado del local (de config_negocio — para el catálogo público)
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
  }

  // 2. Datos del comercio activo (nombre, WhatsApp, GPS)
  const fuente = miComercio; // null si es superadmin sin comercio
  if (fuente) {
    document.getElementById('c-nombre').value = fuente.nombre || '';
    document.getElementById('c-wa').value = fuente.whatsapp || '';
    document.getElementById('c-rubro').value = fuente.rubro || 'kiosco';

    // GPS coords
    if (fuente.coords_lat && fuente.coords_lng) {
      const hint = document.getElementById('c-gps-hint');
      if (hint)
        hint.textContent = `📍 ${fuente.coords_lat.toFixed(5)}, ${fuente.coords_lng.toFixed(5)}`;
    }
  } else if (cfg) {
    // Superadmin: cargar de config_negocio
    document.getElementById('c-nombre').value = cfg.nombre_negocio || '';
    document.getElementById('c-wa').value = cfg.whatsapp_numero || '';
    document.getElementById('c-envio').value = cfg.precio_envio || 3000;
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

  configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('c-nombre').value.trim();
    const whatsapp = document.getElementById('c-wa').value.trim();
    const rubro = document.getElementById('c-rubro')?.value || 'kiosco';
    const abierto = toggleInput.checked;

    if (miComercio) {
      // Guardar en la tabla comercios
      const updates = { nombre, whatsapp, rubro };
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
