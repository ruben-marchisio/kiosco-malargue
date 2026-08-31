/* =============================================
   Kiosco Digital — Gestión de Usuarios
   Solo visible para rol 'admin'
   Crea usuarios via Worker (service_role segura)
   ============================================= */

import { supabase } from './supabase-client.js';

const ROL_LABEL = { admin: '👑 Admin', comercio: '🏪 Comercio', moto: '🏍️ Moto' };
const ROL_COLOR = { admin: '#ff6b35', comercio: '#3b82f6', moto: '#10b981' };

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'https://kiosco-malargue.rubenmarchisio-4e3.workers.dev'
  : '';

// ── Helpers ────────────────────────────────────
function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return `Bearer ${session?.access_token || ''}`;
}

// ── Cargar lista de usuarios ───────────────────
export async function loadUsuarios() {
  const list = document.getElementById('usuarios-list');
  if (!list) return;
  list.innerHTML = '<p class="table-placeholder">Cargando usuarios...</p>';

  const res = await fetch(`${API_BASE}/api/list-users`, {
    headers: { Authorization: await getAuthHeader() },
  });

  if (!res.ok) {
    list.innerHTML = '<p class="table-placeholder">Error al cargar usuarios</p>';
    return;
  }

  const users = await res.json();
  if (!users?.length) {
    list.innerHTML = '<p class="table-placeholder">No hay usuarios registrados</p>';
    return;
  }

  list.innerHTML = `
    <div style="overflow-x:auto">
      <table class="prod-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Rol</th>
            <th>Comercio</th>
            <th>WhatsApp</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
          <tr>
            <td style="font-weight:600">${u.email}</td>
            <td>
              <span style="background:${ROL_COLOR[u.rol] || '#ccc'}20;color:${ROL_COLOR[u.rol] || '#ccc'};
                           padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">
                ${ROL_LABEL[u.rol] || u.rol || '—'}
              </span>
            </td>
            <td>${u.comercio_nombre || '—'}</td>
            <td>${u.comercio_wa ? `+${u.comercio_wa}` : '—'}</td>
            <td style="font-size:12px;color:var(--text-muted)">${new Date(u.created_at).toLocaleDateString('es-AR')}</td>
            <td>
              <button class="btn btn-sm btn-danger" data-del="${u.id}" title="Eliminar usuario">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  // Listeners de eliminar
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteUser(btn.dataset.del));
  });
}

// ── Eliminar usuario ───────────────────────────
async function deleteUser(userId) {
  if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;

  const res = await fetch(`${API_BASE}/api/delete-user`, {
    method: 'DELETE',
    headers: {
      Authorization:  await getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  if (res.ok) {
    await loadUsuarios();
  } else {
    alert('Error al eliminar el usuario');
  }
}

// ── Init: registra el formulario ───────────────
export function initUsuarios() {
  const form      = document.getElementById('usuario-form');
  const rolSelect = document.getElementById('u-rol');
  const camposComercio = document.getElementById('campos-comercio');
  const passInput = document.getElementById('u-password');

  if (!form) return;

  // Generar contraseña automática
  const genBtn = document.getElementById('u-gen-pass');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const p = genPassword();
      passInput.value = p;
      passInput.type = 'text';
      document.getElementById('u-pass-hint').textContent = `🔑 Contraseña generada: ${p} (guardala antes de crear)`;
    });
  }

  // Mostrar/ocultar campos extra según rol
  rolSelect?.addEventListener('change', () => {
    const esCom = rolSelect.value === 'comercio';
    if (camposComercio) camposComercio.style.display = esCom ? 'block' : 'none';
  });

  // Crear usuario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const errorEl   = document.getElementById('u-error');
    const rol       = rolSelect.value;

    const body = {
      email:    document.getElementById('u-email').value.trim(),
      password: passInput.value,
      rol,
    };

    if (rol === 'comercio') {
      body.nombre   = document.getElementById('u-nombre-comercio').value.trim();
      body.rubro    = document.getElementById('u-rubro').value;
      body.whatsapp = document.getElementById('u-whatsapp').value.trim();
    }

    submitBtn.disabled   = true;
    submitBtn.textContent = '⏳ Creando...';
    errorEl.textContent  = '';

    const res = await fetch(`${API_BASE}/api/create-user`, {
      method:  'POST',
      headers: {
        Authorization:  await getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    submitBtn.disabled   = false;
    submitBtn.textContent = '➕ Crear usuario';

    if (!res.ok || data.error) {
      errorEl.textContent = data.error || 'Error al crear usuario';
      return;
    }

    // Éxito
    form.reset();
    if (camposComercio) camposComercio.style.display = 'none';
    document.getElementById('u-pass-hint').textContent = '';
    alert(`✅ Usuario creado correctamente.\nEmail: ${body.email}\nContraseña: ${body.password}\n\n📋 Guardá estos datos para compartirlos.`);
    await loadUsuarios();
  });
}
