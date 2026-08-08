/* =============================================
   Caché de catálogo con invalidación por versión
   Guarda el catálogo completo en localStorage.
   Compara versión remota antes de descargar.
   ============================================= */

const CATALOG_KEY = 'kiosco_catalog_v1';
const VERSION_KEY = 'kiosco_catalog_version';
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
    // Si localStorage está lleno (quota exceeded) simplemente no cacheamos
    console.warn('[cache] No se pudo guardar el catálogo en localStorage:', e.message);
  }
}

/**
 * Elimina el caché del catálogo.
 * Llamar desde Admin cada vez que se modifica el catálogo.
 */
export function clearCatalogCache() {
  localStorage.removeItem(CATALOG_KEY);
  localStorage.removeItem(VERSION_KEY);
}
