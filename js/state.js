/* =============================================
   Estado compartido de la aplicación
   Todos los módulos importan la misma referencia.
   ============================================= */

export const state = {
  allProducts: [],
  cart: JSON.parse(localStorage.getItem('kiosco_cart') || '[]'),
  cartStoreId: localStorage.getItem('kiosco_cart_store_id') || null,
  currentCat: 'todo',
  deferredInstallPrompt: null,
};

/** Persiste el carrito y actualiza el badge. */
export function saveCart() {
  localStorage.setItem('kiosco_cart', JSON.stringify(state.cart));
  if (state.cartStoreId) {
    localStorage.setItem('kiosco_cart_store_id', state.cartStoreId);
  } else {
    localStorage.removeItem('kiosco_cart_store_id');
  }
}
