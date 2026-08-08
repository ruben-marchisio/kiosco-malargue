/* =============================================
   Kiosco Digital — Configuración del negocio
   ============================================= */

import { supabase } from './supabase-client.js';

export async function loadConfig() {
  const { data } = await supabase.from('config_negocio').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('c-nombre').value = data.nombre_negocio || '';
  document.getElementById('c-wa').value = data.whatsapp_numero || '';
  document.getElementById('c-envio').value = data.precio_envio || 500;
  document.getElementById('c-abierto').checked = data.abierto ?? true;
}

export function initConfig() {
  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await supabase
      .from('config_negocio')
      .update({
        nombre_negocio: document.getElementById('c-nombre').value.trim(),
        whatsapp_numero: document.getElementById('c-wa').value.trim(),
        precio_envio: parseFloat(document.getElementById('c-envio').value),
        abierto: document.getElementById('c-abierto').checked,
      })
      .eq('id', 1);
    alert('✅ Configuración guardada');
  });
}
