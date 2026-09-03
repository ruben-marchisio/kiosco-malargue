/* =============================================
   Módulo stores — Gestiona el comercio seleccionado
   por el usuario en el marketplace.

   Flujo:
   1. home.js carga la lista de comercios de Supabase
   2. Usuario toca un local → selectStore()
   3. products.js y checkout.js leen selectedStore
      para filtrar productos y enviar el WA correcto
   ============================================= */

import { supabase } from './api.js';

// ── Estado ────────────────────────────────────
export let selectedStore = null; // comercio actualmente seleccionado
let _storeList = null; // caché en memoria

// Emojis por rubro (para comercios sin logo)
export const RUBRO_EMOJI = {
  kiosco: '🏪',
  verduleria: '🥬',
  ferreteria: '🔧',
  farmacia: '💊',
  comidas: '🍽️',
  panaderia: '🥐',
  carniceria: '🥩',
  libreria: '✏️',
  otros: '🛍️',
};

// ── Seleccionar un comercio ───────────────────
export function selectStore(comercio) {
  selectedStore = comercio;
  // Guardar en sessionStorage para que al volver al home no se pierda el estado
  sessionStorage.setItem('kiosco_store_id', comercio.id);
  // Disparar evento para que home.js y products.js reaccionen
  document.dispatchEvent(new CustomEvent('kiosco:storeSelected', { detail: comercio }));
}

// ── Limpiar selección ─────────────────────────
export function clearStore() {
  selectedStore = null;
  sessionStorage.removeItem('kiosco_store_id');
}

// ── Cargar lista de comercios ─────────────────
export async function loadStores() {
  if (_storeList) return _storeList;

  const { data, error } = await supabase
    .from('comercios')
    .select(
      'id, nombre, rubro, whatsapp, logo_url, abierto, motivo_cierre, mensaje_cierre, hora_reapertura, horario_texto, tiempo_entrega, pedido_minimo, descripcion, orden, color_primario, coords_lat, coords_lng'
    )
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[stores] Error cargando comercios:', error.message);
    return [];
  }

  _storeList = data || [];
  return _storeList;
}

// ── Refrescar estado abierto de un comercio ───
// Llamar cuando el usuario regresa al home (sync liviano)
export async function refreshStoreStatus(comercioId) {
  const { data } = await supabase
    .from('comercios')
    .select('id, abierto, motivo_cierre, mensaje_cierre, hora_reapertura')
    .eq('id', comercioId)
    .single();

  if (!data || !_storeList) return;

  const idx = _storeList.findIndex((c) => c.id === comercioId);
  if (idx !== -1) _storeList[idx] = { ..._storeList[idx], ...data };
  if (selectedStore?.id === comercioId) selectedStore = { ...selectedStore, ...data };
}

// ── Helper: nombre de motivo de cierre ────────
export function motivoLabel(motivo) {
  const labels = {
    horario: 'Fuera de horario',
    clima: 'Condiciones climáticas',
    delivery: 'Demora en delivery',
    otro: 'Cierre temporal',
  };
  return labels[motivo] || 'Cerrado temporalmente';
}

// ── Helper: emoji de motivo de cierre ────────
export function motivoIcon(motivo) {
  const icons = { horario: '🌙', clima: '🌧️', delivery: '🛵', otro: '⏸️' };
  return icons[motivo] || '🔴';
}
