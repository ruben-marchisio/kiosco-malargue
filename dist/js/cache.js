/* =============================================
   Caché de catálogo con invalidación por versión
   Guarda el catálogo completo en localStorage.
   Compara versión remota antes de descargar.
   ============================================= */

const CATALOG_KEY = 'kiosco_catalog_v1';
const VERSION_KEY = 'kiosco_catalog_version';
const STOCK_VER_KEY = 'kiosco_stock_version';
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 h — fallback de seguridad

/**
 * Lee el catálogo guardado localmente.
 * Devuelve { products, version } o null si no existe / expiró.
 */
export function getCachedCatalog() {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    const ver = localStorage.getItem(VERSION_KEY);
    if (!raw || !ver) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.products || !parsed?.savedAt) return null;

    // Expirar si el caché tiene más de MAX_AGE_MS (seguridad adicional)
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearCatalogCache();
      return null;
    }

    return { products: parsed.products, version: ver };
  } catch {
    clearCatalogCache();
    return null;
  }
}

/**
 * Guarda el catálogo y su versión en localStorage.
 * @param {Array}  products - Lista de productos
 * @param {string} version  - Valor de config_negocio.updated_at
 */
export function setCatalogCache(products, version) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ products, savedAt: Date.now() }));
    localStorage.setItem(VERSION_KEY, version);
  } catch (e) {
    console.warn('[cache] No se pudo guardar el catálogo:', e.message);
  }
}

/**
 * Versión de stock (se incrementa en Supabase cuando cambia disponible).
 */
export function getStockVersion() {
  return localStorage.getItem(STOCK_VER_KEY);
}

export function setStockVersion(v) {
  localStorage.setItem(STOCK_VER_KEY, String(v));
}

/**
 * Parchea el campo 'disponible' en el caché local sin re-descargar todo.
 * No toca nombres, precios ni imágenes.
 * @param {{ [id: string]: boolean }} stockMap - id → disponible
 */
export function patchStockInCache(stockMap) {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.products) return;
    parsed.products = parsed.products.map((p) =>
      Object.prototype.hasOwnProperty.call(stockMap, p.id)
        ? { ...p, disponible: stockMap[p.id] }
        : p
    );
    localStorage.setItem(CATALOG_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn('[cache] Error al parchear stock:', e.message);
  }
}

/**
 * Elimina el caché del catálogo (catálogo + versiones).
 */
export function clearCatalogCache() {
  localStorage.removeItem(CATALOG_KEY);
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(STOCK_VER_KEY);
}
