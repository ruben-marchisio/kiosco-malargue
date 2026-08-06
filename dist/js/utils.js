/* =============================================
   Utilidades generales — formato, toast, skeletons
   ============================================= */

const toastEl = document.getElementById('toast');
let toastTimer;

/** Formatea un número al estilo argentino (ej: 1.500). */
export function fmt(n) {
  return Number(n).toLocaleString('es-AR');
}

/** Muestra un mensaje toast durante 2,2 segundos. */
export function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/** Genera n tarjetas skeleton para el estado de carga. */
export function skeletons(n) {
  return Array(n)
    .fill(
      `<div style="border-radius:16px;overflow:hidden;border:1px solid #eee;background:var(--surface)">
        <div class="skeleton" style="aspect-ratio:1"></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
          <div class="skeleton" style="height:13px;border-radius:6px"></div>
          <div class="skeleton" style="height:13px;width:55%;border-radius:6px"></div>
        </div>
      </div>`
    )
    .join('');
}

/** Activa la pestaña indicada en el bottom nav. */
export function setNavActive(tab) {
  document.getElementById('nav-home').classList.toggle('active', tab === 'home');
  document.getElementById('nav-search').classList.toggle('active', tab === 'search');
  document.getElementById('nav-cart').classList.toggle('active', tab === 'cart');
}
