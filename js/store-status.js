/* =============================================
   Estado del local + Orquestador de sincronización

   Flujo de datos:
   ┌─────────────────────────────────────────────┐
   │ loadProducts() ya consulta config_negocio   │
   │  → llama initFromConfig(cfg, catalogVer)    │
   │  → inicializa badge, modal y listeners      │
   └─────────────────────────────────────────────┘

   Syncs posteriores (visibilitychange / pageshow):
   · Cooldown 45 s → 1 query liviana (1 fila)
   · Compara versiones locales vs remotas
   · Solo actualiza lo que cambió:
     - abierto → badge + modal
     - stock_version → parche id+disponible → kiosco:stockPatched
     - updated_at → invalida caché → kiosco:catalogChanged
   ============================================= */

import { supabase } from './api.js';
import { state } from './state.js';
import { getStockVersion, setStockVersion, patchStockInCache, clearCatalogCache } from './cache.js';

// ── Configuración ─────────────────────────────
const COOLDOWN_MS = 45_000; // 45 s entre syncs pasivos

// ── Estado exportado ──────────────────────────
export const storeStatus = {
  abierto: true,
  mensaje: null,
  reapertura: null,
  motivo: 'horario',
};

let lastSyncAt = 0;
let localCatalogVersion = null;

// ── Mapas de motivo ───────────────────────────
const MOTIVO_ICON = { horario: '🌙', clima: '🌧️', delivery: '🛵', otro: '⏸️' };
const MOTIVO_LABEL = {
  horario: 'Fuera de horario',
  clima: 'Condiciones climáticas',
  delivery: 'Demora en delivery',
  otro: 'Cierre temporal',
};

// ── DOM refs ──────────────────────────────────
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const modal = document.getElementById('store-closed-modal');
const modalIcon = document.getElementById('scm-icon');
const modalTitle = document.getElementById('scm-title');
const modalMsg = document.getElementById('scm-message');
const modalReopen = document.getElementById('scm-reopen');
const modalBtn = document.getElementById('scm-btn');

// ── Badge del header ──────────────────────────
function updateBadgeUI() {
  if (!statusBadge) return;
  statusBadge.classList.toggle('closed', !storeStatus.abierto);
  statusText.textContent = storeStatus.abierto ? 'Abierto' : 'Cerrado';
}

// ── Modal de cierre ───────────────────────────
function buildModal() {
  const m = storeStatus.motivo || 'horario';
  if (modalIcon) modalIcon.textContent = MOTIVO_ICON[m] || '⏸️';
  if (modalTitle) modalTitle.textContent = MOTIVO_LABEL[m] || 'Cierre temporal';
  if (modalMsg) {
    const def = storeStatus.reapertura
      ? `Cerrado. Volvemos a abrir a las ${storeStatus.reapertura}.`
      : 'El local está cerrado temporalmente.';
    modalMsg.textContent = storeStatus.mensaje || def;
  }
  if (modalReopen) {
    const showReopen = storeStatus.reapertura && storeStatus.mensaje;
    modalReopen.style.display = showReopen ? 'flex' : 'none';
    if (showReopen) {
      modalReopen.querySelector('.scm-reopen-time').textContent = storeStatus.reapertura;
    }
  }
}

export function showClosedModal() {
  if (storeStatus.abierto || !modal) return;
  buildModal();
  modal.classList.add('open');
}

export function hideClosedModal() {
  if (modal) modal.classList.remove('open');
}

export function isStoreClosed() {
  return !storeStatus.abierto;
}

// ── Aplicar datos de config ───────────────────
function applyConfig(cfg) {
  const wasOpen = storeStatus.abierto;

  storeStatus.abierto = cfg.abierto ?? true;
  storeStatus.mensaje = cfg.mensaje_cierre || null;
  storeStatus.reapertura = cfg.hora_reapertura || null;
  storeStatus.motivo = cfg.motivo_cierre || 'horario';

  updateBadgeUI();

  if (!storeStatus.abierto && wasOpen) {
    // Recién cerrado → limpiar dismissal y mostrar modal
    sessionStorage.removeItem('closed_modal_dismissed');
    setTimeout(showClosedModal, 300);
  } else if (!storeStatus.abierto && !sessionStorage.getItem('closed_modal_dismissed')) {
    setTimeout(showClosedModal, 600);
  } else if (storeStatus.abierto && !wasOpen) {
    hideClosedModal();
  }
}

// ── Parche de stock ───────────────────────────
async function fetchAndPatchStock(remoteStockVersion) {
  const { data, error } = await supabase.from('productos').select('id, disponible');

  if (error || !data) return;

  const stockMap = {};
  data.forEach((p) => {
    stockMap[p.id] = p.disponible;
  });

  // Actualizar state en memoria
  if (state.allProducts?.length) {
    state.allProducts = state.allProducts.map((p) =>
      Object.prototype.hasOwnProperty.call(stockMap, p.id)
        ? { ...p, disponible: stockMap[p.id] }
        : p
    );
  }

  // Parchar caché en localStorage
  patchStockInCache(stockMap);
  setStockVersion(remoteStockVersion);

  // Pedir re-render al app.js
  document.dispatchEvent(new CustomEvent('kiosco:stockPatched'));
}

// ── Sync liviano ──────────────────────────────
async function lightweightSync() {
  const { data: cfg, error } = await supabase
    .from('config_negocio')
    .select('abierto, motivo_cierre, mensaje_cierre, hora_reapertura, updated_at, stock_version')
    .eq('id', 1)
    .single();

  if (error || !cfg) return;

  lastSyncAt = Date.now();

  // 1. Estado del local
  applyConfig(cfg);

  // 2. Stock (si cambió stock_version)
  const remoteStock = String(cfg.stock_version ?? 1);
  if (remoteStock !== getStockVersion()) {
    await fetchAndPatchStock(remoteStock);
  }

  // 3. Catálogo completo (si cambió updated_at)
  if (localCatalogVersion && cfg.updated_at !== localCatalogVersion) {
    localCatalogVersion = cfg.updated_at;
    clearCatalogCache();
    document.dispatchEvent(new CustomEvent('kiosco:catalogChanged'));
  }
}

// ── API pública: sync con cooldown ───────────
export function syncIfNeeded() {
  if (Date.now() - lastSyncAt < COOLDOWN_MS) return;
  lightweightSync();
}

// ── Inicialización desde loadProducts() ──────
// Recibe el cfg ya consultado para no duplicar la query
export function initFromConfig(cfg, catalogVersion) {
  if (!cfg) return;

  localCatalogVersion = catalogVersion;

  // Guardar versión de stock si no la tenemos
  const remoteStock = String(cfg.stock_version ?? 1);
  if (!getStockVersion()) setStockVersion(remoteStock);

  applyConfig(cfg);
  lastSyncAt = Date.now();

  // Registrar listeners solo una vez
  if (!window._kioscoSyncBound) {
    window._kioscoSyncBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncIfNeeded();
    });

    window.addEventListener('pageshow', (e) => {
      // persisted = true cuando vuelve del bfcache (celular)
      if (e.persisted) syncIfNeeded();
    });
  }
}

// ── Botón "Entendido" del modal ───────────────
if (modalBtn) {
  modalBtn.addEventListener('click', () => {
    hideClosedModal();
    sessionStorage.setItem('closed_modal_dismissed', '1');
  });
}
