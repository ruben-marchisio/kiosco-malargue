/* global L, ADMIN_EMAIL */
// ── Ubicación del usuario (localStorage) ─────
const LOCATION_KEY = 'kiosco_user_location';

export function getUserLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUserLocation(lat, lng, label) {
  const loc = { lat, lng, label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
  // Notificar a otros módulos (home, products) para que recalculen distancias
  document.dispatchEvent(new CustomEvent('kiosco:locationSaved', { detail: loc }));
  return loc;
}

export function clearUserLocation() {
  localStorage.removeItem(LOCATION_KEY);
  document.dispatchEvent(new CustomEvent('kiosco:locationSaved', { detail: null }));
}
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
const btnLoginEmail = document.getElementById('btn-login-email');
const btnShowEmailLogin = document.getElementById('btn-show-email-login');
const inputLoginEmail = document.getElementById('login-email');
const inputLoginPassword = document.getElementById('login-password');
const btnLogout = document.getElementById('btn-logout');

let currentUser = null;
let realtimeSubscription = null;

// ── Variables Mapa GPS ────────────────────────
let gpsChannel = null;
let activeMaps = {};
let activeMarkers = {};

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

async function showAuthUI() {
  perfilUnauth.style.display = 'none';
  perfilAuth.style.display = 'block';

  const nombre =
    currentUser.user_metadata?.nombre ||
    currentUser.user_metadata?.full_name ||
    currentUser.user_metadata?.name ||
    '';
  perfilNombre.textContent = nombre || currentUser.email || 'Usuario';
  perfilEmail.textContent = currentUser.email || '';
  perfilAvatar.src =
    currentUser.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=U&background=random';

  // Verificar rol para mostrar botón de panel admin/moto
  const btnAdminPanel = document.getElementById('btn-admin-panel');
  if (btnAdminPanel) {
    btnAdminPanel.style.display = 'none'; // reset por si acaso
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('rol')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const adminEmail = (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : '')
        .toLowerCase()
        .trim();
      const userEmail = (currentUser.email || '').toLowerCase().trim();
      const rol = data?.rol ?? (userEmail === adminEmail && userEmail !== '' ? 'admin' : null);

      if (rol) {
        btnAdminPanel.style.display = 'inline-block';
        btnAdminPanel.onclick = () => {
          if (rol === 'moto') window.location.href = '/moto';
          else window.location.href = '/admin';
        };
      }
    } catch (e) {
      console.warn('Error verificando rol:', e);
    }
  }

  // Renderizar la sección de ubicación
  renderLocationSection();
}

// ── UI de Ubicación en Perfil ─────────────────
function renderLocationSection() {
  const container = document.getElementById('perfil-location-section');
  if (!container) return;

  const loc = getUserLocation();
  const locLabel = loc ? loc.label : null;

  container.innerHTML = `
    <div style="margin-bottom: 12px">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px">
        <div style="width: 36px; height: 36px; background: #e0f2fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px">📍</div>
        <div>
          <div style="font-weight: 700; font-size: 14px">Mi ubicación</div>
          <div id="perfil-loc-label" style="font-size: 12px; color: var(--text-muted)">
            ${locLabel ? `✅ ${locLabel}` : 'No configurada aún'}
          </div>
        </div>
        ${loc ? `<button id="btn-loc-clear" style="margin-left: auto; background: #fee2e2; color: #991b1b; border: none; padding: 5px 10px; border-radius: 8px; font-size: 12px; cursor: pointer">Borrar</button>` : ''}
      </div>
      <div style="display: flex; gap: 8px">
        <button id="btn-loc-gps" style="flex: 1; padding: 10px; background: var(--primary); color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer">📡 Usar GPS</button>
        <button id="btn-loc-dir" style="flex: 1; padding: 10px; background: var(--surface); color: var(--text); border: 1.5px solid var(--border); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer">✏️ Por dirección</button>
      </div>
      <div id="perfil-loc-dir-wrap" style="display: none; margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap">
        <input id="perfil-loc-dir-input" type="text" placeholder="Ej: San Martín 420" style="flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px" />
        <button id="btn-loc-dir-buscar" style="padding: 10px 16px; background: var(--primary); color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer">Buscar</button>
      </div>
      <p id="perfil-loc-status" style="font-size: 12px; color: var(--text-muted); margin-top: 6px; min-height: 16px"></p>
    </div>
  `;

  // Wiring de botones
  document.getElementById('btn-loc-gps')?.addEventListener('click', handleLocGps);
  document.getElementById('btn-loc-dir')?.addEventListener('click', () => {
    const wrap = document.getElementById('perfil-loc-dir-wrap');
    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('btn-loc-dir-buscar')?.addEventListener('click', handleLocDir);
  document.getElementById('perfil-loc-dir-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLocDir();
    }
  });
  document.getElementById('btn-loc-clear')?.addEventListener('click', () => {
    clearUserLocation();
    renderLocationSection();
    import('./utils.js').then(({ showToast }) => showToast('Ubicación eliminada'));
  });
}

function handleLocGps() {
  const status = document.getElementById('perfil-loc-status');
  if (status) status.textContent = '📡 Obteniendo ubicación...';
  if (!navigator.geolocation) {
    if (status) status.textContent = '❌ GPS no disponible en este dispositivo.';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      // Geocoding inverso para obtener el nombre de la calle
      let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`,
          { headers: { 'User-Agent': 'KioscoMalargue/1.0' } }
        );
        const data = await res.json();
        if (data?.address) {
          const { road, house_number, suburb } = data.address;
          label = [road, house_number, suburb].filter(Boolean).join(' ');
        }
      } catch {
        /* usar coords como label */
      }
      saveUserLocation(lat, lng, label);
      renderLocationSection();
      showToast('✅ Ubicación guardada');
    },
    () => {
      if (document.getElementById('perfil-loc-status'))
        document.getElementById('perfil-loc-status').textContent =
          '❌ Permiso denegado. Activá el GPS.';
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

async function handleLocDir() {
  const input = document.getElementById('perfil-loc-dir-input');
  const status = document.getElementById('perfil-loc-status');
  const texto = input?.value.trim();
  if (!texto) {
    if (status) status.textContent = '⚠️ Escribí una dirección.';
    return;
  }
  if (status) status.textContent = '🔍 Buscando...';
  try {
    const query = encodeURIComponent(`${texto}, Malargüe, Mendoza, Argentina`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`,
      { headers: { 'Accept-Language': 'es', 'User-Agent': 'KioscoMalargue/1.0' } }
    );
    const data = await res.json();
    if (!data?.length) {
      if (status) status.textContent = '❌ No encontré esa dirección. Intentá con otra.';
      return;
    }
    const { lat, lon, display_name } = data[0];
    const label = display_name.split(',').slice(0, 2).join(',').trim();
    saveUserLocation(parseFloat(lat), parseFloat(lon), label);
    renderLocationSection();
    showToast('✅ Ubicación guardada');
  } catch {
    if (status) status.textContent = '❌ Error de conexión. Intentá con GPS.';
  }
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

// Toggle del panel de login por email (solo para motos/locales)
if (btnShowEmailLogin) {
  btnShowEmailLogin.addEventListener('click', () => {
    const panel = document.getElementById('email-login-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
}

if (btnLoginEmail) {
  btnLoginEmail.addEventListener('click', async () => {
    const email = inputLoginEmail.value.trim();
    const password = inputLoginPassword.value.trim();
    if (!email || !password) return showToast('⚠️ Ingresá correo y contraseña');

    try {
      btnLoginEmail.textContent = '⏳...';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      inputLoginEmail.value = '';
      inputLoginPassword.value = '';
      checkSession();
      showToast('¡Bienvenido!');
    } catch (error) {
      console.error('Error Email Login:', error.message);
      alert('Error al iniciar sesión. Verificá tus datos.');
    } finally {
      btnLoginEmail.textContent = 'Ingresar';
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
        ${p.estado === 'en_camino' && p.gps_lat && p.gps_lng ? `<div id="map-${p.id}" style="height: 180px; margin-top: 16px; border-radius: 8px; z-index: 1;"></div>` : ''}
      </div>
    `;
    })
    .join('');

  // Inicializar mapas después de inyectar el HTML
  setTimeout(() => initMaps(data), 50);
}

// ── GPS Tracking Map (Leaflet) ────────────────
function initMaps(pedidos) {
  // Limpiar mapas anteriores si existían
  Object.values(activeMaps).forEach((map) => map.remove());
  activeMaps = {};
  activeMarkers = {};
  const notifiedArrival = window.notifiedArrival || {};
  window.notifiedArrival = notifiedArrival;

  let needsGps = false;

  pedidos.forEach((p) => {
    if (p.estado === 'en_camino' && p.gps_lat && p.gps_lng) {
      needsGps = true;
      const mapId = `map-${p.id}`;
      const el = document.getElementById(mapId);

      if (el && window.L) {
        const map = L.map(mapId, { zoomControl: false }).setView([p.gps_lat, p.gps_lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        // Marcador del Cliente (Casa)
        const casaIcon = L.divIcon({
          html: '<span style="font-size:24px;">🏠</span>',
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([p.gps_lat, p.gps_lng], { icon: casaIcon }).addTo(map);

        // Marcador de la Moto (Inicia en la casa, saltará a la moto cuando llegue el ping)
        const motoIcon = L.divIcon({
          html: '<span style="font-size:32px;">🛵</span>',
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const motoMarker = L.marker([p.gps_lat, p.gps_lng], { icon: motoIcon }).addTo(map);

        activeMaps[p.id] = map;
        activeMarkers[p.id] = {
          moto: motoMarker,
          repartidor_id: p.repartidor_id,
          casaLatLng: [p.gps_lat, p.gps_lng],
        };
      }
    }
  });

  if (needsGps) {
    startListeningMotoGps();
  }
}

async function startListeningMotoGps() {
  if (gpsChannel) return;
  gpsChannel = supabase.channel('motos-gps');

  gpsChannel.on('presence', { event: 'sync' }, () => {
    const state = gpsChannel.presenceState();
    // state contiene todos los usuarios transmitiendo
    for (const key in state) {
      state[key].forEach((pres) => {
        if (pres.lat && pres.lng && pres.repartidor_id) {
          updateMotoPosition(pres.repartidor_id, pres.lat, pres.lng);
        }
      });
    }
  });

  await gpsChannel.subscribe();
}

function updateMotoPosition(repartidor_id, lat, lng) {
  Object.keys(activeMarkers).forEach((pedidoId) => {
    if (activeMarkers[pedidoId].repartidor_id === repartidor_id) {
      const marker = activeMarkers[pedidoId].moto;
      const map = activeMaps[pedidoId];
      if (marker && map) {
        const newPos = [lat, lng];
        marker.setLatLng(newPos);

        // Centrar dinámicamente si se quiere
        // map.panTo(newPos);

        // Notificar llegada (menos de 150 metros)
        const casaPos = activeMarkers[pedidoId].casaLatLng;
        if (casaPos) {
          const distance = map.distance(newPos, casaPos);
          if (distance < 150 && !window.notifiedArrival[pedidoId]) {
            window.notifiedArrival[pedidoId] = true;
            showToast('🛵 ¡Tu delivery está llegando! Salí a recibirlo.');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }
        }
      }
    }
  });
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
