import { supabase } from './api.js';
import { closeCart } from './cart.js';
import { closeSearch } from './search.js';
import { showToast } from './utils.js';

// DOM Elements
const perfilView = document.getElementById('perfil-view');
const homeView = document.getElementById('home-view');
const productsView = document.getElementById('products-view');

const perfilUnauth = document.getElementById('perfil-unauth');
const perfilAuth = document.getElementById('perfil-auth');
const perfilAvatar = document.getElementById('perfil-avatar');
const perfilNombre = document.getElementById('perfil-nombre');
const perfilEmail = document.getElementById('perfil-email');
const pedidosList = document.getElementById('pedidos-activos-list');

const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');

let currentUser = null;
let realtimeSubscription = null;

// ── Navegación ────────────────────────────────
export function showPerfilView() {
  closeCart();
  closeSearch();

  if (homeView) homeView.style.display = 'none';
  if (productsView) productsView.style.display = 'none';
  perfilView.style.display = 'block';

  document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
  document.getElementById('nav-perfil')?.classList.add('active');

  checkSession();
}

// ── Autenticación ─────────────────────────────
async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showAuthUI();
    loadPedidosActivos();
    subscribeToOrders();
  } else {
    currentUser = null;
    showUnauthUI();
    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);
      realtimeSubscription = null;
    }
  }
}

function showUnauthUI() {
  perfilUnauth.style.display = 'block';
  perfilAuth.style.display = 'none';
}

function showAuthUI() {
  perfilUnauth.style.display = 'none';
  perfilAuth.style.display = 'block';

  perfilNombre.textContent = currentUser.user_metadata?.full_name || 'Usuario';
  perfilEmail.textContent = currentUser.email || '';
  perfilAvatar.src =
    currentUser.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=U&background=random';
}

if (btnLoginGoogle) {
  btnLoginGoogle.addEventListener('click', async () => {
    try {
      btnLoginGoogle.textContent = '⏳ Cargando...';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error Google Login:', error.message);
      alert('Error al conectar con Google. Intentá de nuevo.');
      btnLoginGoogle.innerHTML =
        '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width:20px;" /> Continuar con Google';
    }
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkSession();
    showToast('Sesión cerrada');
  });
}

// ── Pedidos Activos ───────────────────────────
async function loadPedidosActivos() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from('pedidos')
    .select('*, comercios(nombre)')
    .eq('cliente_id', currentUser.id)
    .in('estado', ['pendiente', 'en_preparacion', 'listo', 'en_camino'])
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    pedidosList.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); background: white; border-radius: 16px; border: 1px dashed #ddd;">No tenés pedidos activos ahora.</div>`;
    return;
  }

  pedidosList.innerHTML = data
    .map((p) => {
      let icon = '🕒';
      let statusText = 'Pendiente';
      let color = '#f59e0b';

      if (p.estado === 'en_preparacion') {
        icon = '👨‍🍳';
        statusText = 'En preparación';
        color = '#3b82f6';
      }
      if (p.estado === 'listo') {
        icon = '✅';
        statusText = 'Listo para retirar';
        color = '#10b981';
      }
      if (p.estado === 'en_camino') {
        icon = '🛵';
        statusText = 'En camino hacia tu puerta';
        color = '#8b5cf6';
      }

      return `
      <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; border-left: 4px solid ${color}; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="font-size: 14px;">🏪 ${p.comercios?.nombre || 'Local'}</strong>
          <span style="font-size: 12px; color: var(--text-muted);">$${p.monto_total}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: ${color};">
          <span>${icon}</span> ${statusText}
        </div>
      </div>
    `;
    })
    .join('');
}

function subscribeToOrders() {
  if (!currentUser || realtimeSubscription) return;

  realtimeSubscription = supabase
    .channel('public:pedidos:cliente')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: `cliente_id=eq.${currentUser.id}`,
      },
      (payload) => {
        loadPedidosActivos(); // Recargar la lista para actualizar los estados visualmente

        // Mostrar toast notification
        const e = payload.new.estado;
        if (e === 'en_preparacion') showToast('👨‍🍳 ¡Tu pedido se está preparando!');
        if (e === 'listo') showToast('✅ ¡Tu pedido está listo!');
        if (e === 'en_camino') showToast('🛵 ¡Tu pedido va en camino!');
        if (e === 'entregado') showToast('🎉 ¡Pedido entregado! Que lo disfrutes.');
      }
    )
    .subscribe();
}

// Inicializar sesión si se entra en la app (opcional, en app.js llamamos a checkSession)
// checkSession();
