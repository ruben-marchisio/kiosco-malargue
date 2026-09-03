/* =============================================
   Kiosco Digital — Gestión de Usuarios
   Solo visible para rol 'admin'
   Crea usuarios via Worker (service_role segura)
   ============================================= */

import { supabase } from './supabase-client.js';

const ROL_LABEL = { admin: '👑 Admin', comercio: '🏪 Comercio', moto: '🏍️ Moto' };
const ROL_COLOR = { admin: '#ff6b35', comercio: '#3b82f6', moto: '#10b981' };

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://kiosco-malargue.rubenmarchisio-4e3.workers.dev'
    : '';

// ── Helpers ────────────────────────────────────
function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getAuthHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
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
            <th>Usuario</th>
            <th>Rol / Estado</th>
            <th>Datos Personales</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map((u) => {
              const isBanned = !!u.banned_until;
              const meta = u.meta || {};
              const dniTxt = meta.dni ? `DNI: ${meta.dni}` : '';
              const dirTxt = meta.direccion ? `<br>📍 ${meta.direccion}` : '';
              const vehiculoTxt = meta.vehiculo ? `<br>🛵 ${meta.vehiculo}` : '';
              const nombreTitular = meta.titular_nombre || u.email;

              return `
          <tr style="opacity: ${isBanned ? '0.6' : '1'}">
            <td>
              <div style="font-weight:600">${nombreTitular}</div>
              <div style="font-size:12px;color:var(--text-muted)">${u.email}</div>
              <div style="font-size:11px;color:var(--text-muted)">Alta: ${new Date(u.created_at).toLocaleDateString('es-AR')}</div>
            </td>
            <td>
              <span style="background:${ROL_COLOR[u.rol] || '#ccc'}20;color:${ROL_COLOR[u.rol] || '#ccc'};
                           padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">
                ${ROL_LABEL[u.rol] || u.rol || '—'}
              </span>
              ${isBanned ? `<div style="margin-top:6px;color:#ef4444;font-size:11px;font-weight:bold;">⛔ SUSPENDIDO</div>` : ''}
            </td>
            <td style="font-size:12px">
              ${dniTxt}
              ${dirTxt}
              ${vehiculoTxt}
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary" data-pass="${u.id}" title="Cambiar clave">🔑</button>
                <button class="btn btn-sm btn-secondary" data-ban="${u.id}" data-banned="${isBanned ? '1' : '0'}" title="${isBanned ? 'Habilitar acceso' : 'Suspender acceso'}">
                  ${isBanned ? '🟢' : '⛔'}
                </button>
                <button class="btn btn-sm btn-danger" data-del="${u.id}" title="Eliminar definitivamente">🗑️</button>
              </div>
            </td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;

  // Listeners de acciones
  list.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteUser(btn.dataset.del));
  });
  list.querySelectorAll('[data-pass]').forEach((btn) => {
    btn.addEventListener('click', () => changePassword(btn.dataset.pass));
  });
  list.querySelectorAll('[data-ban]').forEach((btn) => {
    btn.addEventListener('click', () => toggleBan(btn.dataset.ban, btn.dataset.banned === '1'));
  });
}

// ── Eliminar usuario ───────────────────────────
async function deleteUser(userId) {
  if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;

  const res = await fetch(`${API_BASE}/api/delete-user`, {
    method: 'DELETE',
    headers: {
      Authorization: await getAuthHeader(),
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

// ── Cambiar Contraseña ─────────────────────────
async function changePassword(userId) {
  const newPass = window.prompt('Ingresá la nueva contraseña (mínimo 8 caracteres):');
  if (!newPass) return;
  if (newPass.length < 8) return alert('La contraseña debe tener al menos 8 caracteres.');

  const res = await fetch(`${API_BASE}/api/change-password`, {
    method: 'POST',
    headers: { Authorization: await getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, password: newPass }),
  });

  if (res.ok) alert('✅ Contraseña actualizada correctamente.');
  else alert('❌ Error al actualizar la contraseña.');
}

// ── Suspender / Habilitar ──────────────────────
async function toggleBan(userId, isBanned) {
  const action = isBanned ? 'habilitar' : 'suspender';
  if (
    !confirm(
      `¿Estás seguro que querés ${action} a este usuario?\\nSi lo suspendés, no podrá iniciar sesión en la app ni aceptar/gestionar pedidos.`
    )
  )
    return;

  const res = await fetch(`${API_BASE}/api/toggle-ban`, {
    method: 'POST',
    headers: { Authorization: await getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ban: !isBanned }),
  });

  if (res.ok) await loadUsuarios();
  else alert(`❌ Error al ${action} el usuario.`);
}

// ── Init: registra el formulario ───────────────
export function initUsuarios() {
  const form = document.getElementById('usuario-form');
  const rolSelect = document.getElementById('u-rol');
  const camposComercio = document.getElementById('campos-comercio');
  const camposMoto = document.getElementById('campos-moto');
  const passInput = document.getElementById('u-password');

  if (!form) return;

  // Generar contraseña automática
  const genBtn = document.getElementById('u-gen-pass');
  if (genBtn) {
    genBtn.addEventListener('click', () => {
      const p = genPassword();
      passInput.value = p;
      passInput.type = 'text';
      document.getElementById('u-pass-hint').textContent =
        `🔑 Contraseña generada: ${p} (guardala antes de crear)`;
    });
  }

  // Mostrar/ocultar campos extra según rol
  rolSelect?.addEventListener('change', () => {
    const rol = rolSelect.value;
    if (camposComercio) camposComercio.style.display = rol === 'comercio' ? 'block' : 'none';
    if (camposMoto) camposMoto.style.display = rol === 'moto' ? 'block' : 'none';
  });

  // Crear usuario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const errorEl = document.getElementById('u-error');
    const rol = rolSelect.value;

    const body = {
      email: document.getElementById('u-email').value.trim(),
      password: passInput.value,
      rol,
      dni: document.getElementById('u-dni')?.value.trim(),
      titular_nombre: document.getElementById('u-titular')?.value.trim(),
      direccion: document.getElementById('u-direccion')?.value.trim(),
    };

    if (rol === 'moto') {
      body.vehiculo = document.getElementById('u-vehiculo')?.value.trim();
    }

    if (rol === 'comercio') {
      body.nombre = document.getElementById('u-nombre-comercio').value.trim();
      body.rubro = document.getElementById('u-rubro').value;
      body.whatsapp = document.getElementById('u-whatsapp').value.trim();
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Creando...';
    errorEl.textContent = '';

    const res = await fetch(`${API_BASE}/api/create-user`, {
      method: 'POST',
      headers: {
        Authorization: await getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    submitBtn.disabled = false;
    submitBtn.textContent = '➕ Crear usuario';

    if (!res.ok || data.error) {
      errorEl.textContent = data.error || 'Error al crear usuario';
      return;
    }

    // Éxito
    form.reset();
    if (camposComercio) camposComercio.style.display = 'none';
    document.getElementById('u-pass-hint').textContent = '';
    alert(
      `✅ Usuario creado correctamente.\nEmail: ${body.email}\nContraseña: ${body.password}\n\n📋 Guardá estos datos para compartirlos.`
    );
    await loadUsuarios();
  });
}
