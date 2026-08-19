/* =============================================
   Kiosco Digital — Configuración del negocio
   Gestiona el panel de apertura/cierre del local
   y los datos generales del negocio.
   ============================================= */

import { supabase } from './supabase-client.js';

// ── DOM refs del panel de estado ──────────────
const toggleInput = document.getElementById('c-abierto');
const toggleCard = document.getElementById('store-toggle-card');
const closeOptions = document.getElementById('store-close-options');
const toggleEmoji = document.getElementById('store-toggle-emoji');
const toggleLabel = document.getElementById('store-toggle-label');
const toggleSub = document.getElementById('store-toggle-sub');
const templateBtns = document.querySelectorAll('.template-btn');
const horaInput = document.getElementById('c-hora-reap');
const mensajeInput = document.getElementById('c-mensaje-cierre');

// Motivo activo
let motivoActivo = 'horario';

// ── Actualizar UI del panel según estado ──────
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

// ── Seleccionar plantilla de mensaje ─────────
templateBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    templateBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    motivoActivo = btn.dataset.motivo;
    // Si tiene mensaje predefinido, llenarlo (salvo que sea "otro")
    if (btn.dataset.msg) {
      mensajeInput.value = btn.dataset.msg;
    } else {
      mensajeInput.value = '';
    }
  });
});

// ── Reaccionar al toggle ──────────────────────
toggleInput.addEventListener('change', async () => {
  const abierto = toggleInput.checked;
  updatePanelUI(abierto);

  // Guardar inmediatamente en Supabase (sin esperar el form)
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

// ── Carga la config desde Supabase ───────────
export async function loadConfig() {
  const { data } = await supabase.from('config_negocio').select('*').eq('id', 1).single();

  if (!data) return;

  // Datos del negocio
  document.getElementById('c-nombre').value = data.nombre_negocio || '';
  document.getElementById('c-wa').value = data.whatsapp_numero || '';
  document.getElementById('c-envio').value = data.precio_envio || 500;

  // Estado del local
  const abierto = data.abierto ?? true;
  toggleInput.checked = abierto;
  updatePanelUI(abierto);

  // Restaurar motivo y mensaje guardados
  if (!abierto) {
    motivoActivo = data.motivo_cierre || 'horario';
    templateBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.motivo === motivoActivo);
    });
    mensajeInput.value = data.mensaje_cierre || '';
    horaInput.value = data.hora_reapertura || '';
  }
}

// ── Guardar config del negocio ────────────────
export function initConfig() {
  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const abierto = toggleInput.checked;
    await supabase
      .from('config_negocio')
      .update({
        nombre_negocio: document.getElementById('c-nombre').value.trim(),
        whatsapp_numero: document.getElementById('c-wa').value.trim(),
        precio_envio: parseFloat(document.getElementById('c-envio').value),
        abierto,
        motivo_cierre: abierto ? null : motivoActivo,
        mensaje_cierre: abierto ? null : mensajeInput.value.trim() || null,
        hora_reapertura: abierto ? null : horaInput.value || null,
      })
      .eq('id', 1);
    alert('✅ Configuración guardada');
  });
}
