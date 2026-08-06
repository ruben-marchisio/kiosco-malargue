/* =============================================
   Kiosco Digital — Panel Administración
   ============================================= */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const CAT_EMOJI = {
  bebidas: '🥤',
  snacks: '🍫',
  comidas: '🍽️',
  panaderia: '🥐',
  verduleria: '🥦',
  limpieza: '🧹',
  otros: '📦',
};
const fmt = (n) => Number(n).toLocaleString('es-AR');

// ── DOM refs ──────────────────────────────────
const loginWrap = document.getElementById('login-wrap');
const adminLayout = document.getElementById('admin-layout');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// ── Auth ──────────────────────────────────────
supabase.auth.onAuthStateChange((_e, session) => {
  if (session) showAdmin();
  else showLogin();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    loginError.textContent = 'Email o contraseña incorrectos';
    loginError.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

function showLogin() {
  loginWrap.style.display = 'flex';
  adminLayout.classList.remove('visible');
}

function showAdmin() {
  loginWrap.style.display = 'none';
  adminLayout.classList.add('visible');
  loadDashboard();
}

// ── Navigation ────────────────────────────────
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.page;
    pages.forEach((p) => (p.style.display = p.id === target ? 'block' : 'none'));
    if (target === 'page-stock') loadStock();
    if (target === 'page-pedidos') loadPedidos();
    if (target === 'page-config') loadConfig();
  });
});

// ── DASHBOARD ────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];

  const [{ data: prods }, { data: pedidos }] = await Promise.all([
    supabase.from('productos').select('id,disponible'),
    supabase
      .from('pedidos_log')
      .select('monto_total,monto_envio,monto_comision,created_at')
      .gte('created_at', today),
  ]);

  const totalProds = prods?.length || 0;
  const disponibles = prods?.filter((p) => p.disponible).length || 0;
  const ventaHoy = pedidos?.reduce((s, p) => s + Number(p.monto_total), 0) || 0;
  const enviosHoy = pedidos?.reduce((s, p) => s + Number(p.monto_envio), 0) || 0;
  const comisionHoy = pedidos?.reduce((s, p) => s + Number(p.monto_comision), 0) || 0;

  document.getElementById('stat-prods').textContent = totalProds;
  document.getElementById('stat-activos').textContent = disponibles;
  document.getElementById('stat-venta').textContent = `$${fmt(ventaHoy)}`;
  document.getElementById('stat-envios').textContent = `$${fmt(enviosHoy)}`;
  document.getElementById('stat-comision').textContent = `$${fmt(comisionHoy)}`;
  document.getElementById('stat-pedidos').textContent = pedidos?.length || 0;
}

// ── STOCK ────────────────────────────────────
async function loadStock() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center;padding:30px;color:#888">Cargando...</td></tr>';
  const { data } = await supabase.from('productos').select('*').order('categoria').order('nombre');
  if (!data?.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:30px">No hay productos</td></tr>';
    return;
  }

  tbody.innerHTML = data
    .map(
      (p) => `
    <tr>
      <td>
        <div class="prod-name-cell">
          <div class="prod-thumb">${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre}">` : CAT_EMOJI[p.categoria] || '📦'}</div>
          <div>
            <div style="font-weight:600">${p.nombre}</div>
            ${p.es_tercero ? `<div style="font-size:11px;color:#888">Vecino: ${p.proveedor_nombre || '—'}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="cat-badge">${p.categoria}</span></td>
      <td class="price-cell">$${fmt(p.precio)}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${p.disponible ? 'checked' : ''} data-toggle="${p.id}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" data-edit="${p.id}">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" data-delete="${p.id}" style="margin-left:6px">🗑️</button>
      </td>
    </tr>
  `
    )
    .join('');

  // Toggle disponible
  tbody.querySelectorAll('[data-toggle]').forEach((input) => {
    input.addEventListener('change', async () => {
      await supabase
        .from('productos')
        .update({ disponible: input.checked })
        .eq('id', input.dataset.toggle);
    });
  });

  // Edit
  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    const prod = data.find((p) => p.id === btn.dataset.edit);
    btn.addEventListener('click', () => openProductModal(prod));
  });

  // Delete
  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminár este producto?')) return;
      await supabase.from('productos').delete().eq('id', btn.dataset.delete);
      loadStock();
    });
  });
}

// ── PRODUCT MODAL ─────────────────────────────
const modal = document.getElementById('product-modal');
const modalTitle = document.getElementById('modal-title');
const productForm = document.getElementById('product-form');
let editingId = null;

document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));
document.getElementById('modal-close').addEventListener('click', closeProductModal);
document.getElementById('modal-cancel').addEventListener('click', closeProductModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeProductModal();
});

function openProductModal(prod) {
  editingId = prod?.id || null;
  modalTitle.textContent = prod ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('f-nombre').value = prod?.nombre || '';
  document.getElementById('f-descripcion').value = prod?.descripcion || '';
  document.getElementById('f-categoria').value = prod?.categoria || 'otros';
  document.getElementById('f-precio').value = prod?.precio || '';
  document.getElementById('f-imagen').value = prod?.imagen_url || '';
  document.getElementById('f-tercero').checked = prod?.es_tercero || false;
  document.getElementById('f-proveedor').value = prod?.proveedor_nombre || '';
  document.getElementById('f-disponible').checked = prod?.disponible ?? true;
  modal.classList.add('open');
}

function closeProductModal() {
  modal.classList.remove('open');
}

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById('f-nombre').value.trim(),
    descripcion: document.getElementById('f-descripcion').value.trim(),
    categoria: document.getElementById('f-categoria').value,
    precio: parseFloat(document.getElementById('f-precio').value),
    imagen_url: document.getElementById('f-imagen').value.trim() || null,
    es_tercero: document.getElementById('f-tercero').checked,
    proveedor_nombre: document.getElementById('f-proveedor').value.trim() || null,
    disponible: document.getElementById('f-disponible').checked,
  };

  if (editingId) await supabase.from('productos').update(payload).eq('id', editingId);
  else await supabase.from('productos').insert(payload);

  closeProductModal();
  loadStock();
  loadDashboard();
});

// ── PEDIDOS LOG ───────────────────────────────
async function loadPedidos() {
  const list = document.getElementById('pedidos-list');
  list.innerHTML = '<p style="text-align:center;color:#888;padding:30px">Cargando...</p>';
  const { data } = await supabase
    .from('pedidos_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data?.length) {
    list.innerHTML =
      '<p style="text-align:center;color:#888;padding:30px">Aún no hay pedidos registrados</p>';
    return;
  }

  list.innerHTML = data
    .map((p) => {
      const d = new Date(p.created_at);
      const hora = d.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      return `
      <div class="log-item">
        <div class="log-icon">${p.es_delivery ? '🚴' : '🏪'}</div>
        <div class="log-info">
          <div class="log-time">${fecha} · ${hora}</div>
          <div class="log-desc">${p.notas || (p.es_delivery ? 'Delivery' : 'Retiro en local')}${p.monto_comision > 0 ? ` · Comisión: $${fmt(p.monto_comision)}` : ''}</div>
        </div>
        <div class="log-total">$${fmt(p.monto_total)}</div>
      </div>`;
    })
    .join('');
}

// ── REGISTRAR PEDIDO MANUAL ───────────────────
const pedidoForm = document.getElementById('pedido-form');
pedidoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const monto_total = parseFloat(document.getElementById('p-total').value);
  const monto_envio = parseFloat(document.getElementById('p-envio').value || 0);
  const es_delivery = document.getElementById('p-delivery').checked;
  const es_tercero = document.getElementById('p-comision').checked;
  const notas = document.getElementById('p-notas').value.trim();
  const monto_comision = es_tercero ? +(monto_total * 0.1).toFixed(2) : 0;

  await supabase
    .from('pedidos_log')
    .insert({ monto_total, monto_envio, es_delivery, monto_comision, notas });
  pedidoForm.reset();
  document.getElementById('p-delivery').checked = true;
  loadPedidos();
  loadDashboard();
});

// ── CONFIG ────────────────────────────────────
async function loadConfig() {
  const { data } = await supabase.from('config_negocio').select('*').eq('id', 1).single();
  if (!data) return;
  document.getElementById('c-nombre').value = data.nombre_negocio || '';
  document.getElementById('c-wa').value = data.whatsapp_numero || '';
  document.getElementById('c-envio').value = data.precio_envio || 500;
  document.getElementById('c-abierto').checked = data.abierto ?? true;
}

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
