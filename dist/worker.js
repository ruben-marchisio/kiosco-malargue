/**
 * Cloudflare Worker — Kiosco Digital Malargüe
 * Sirve los assets estáticos + expone /api/create-user, /api/list-users, /api/delete-user
 * La service_role key NUNCA llega al frontend.
 *
 * Variables de entorno requeridas (wrangler secret put):
 *   SUPABASE_URL          → https://nlnfkdrdssaaynlrnfpj.supabase.co
 *   SUPABASE_SERVICE_ROLE → tu service_role key de Supabase
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    // ── Preflight CORS (OPTIONS) ───────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // ── API Routes ─────────────────────────────
    if (url.pathname === '/api/create-user' && request.method === 'POST') {
      return handleCreateUser(request, env);
    }

    if (url.pathname === '/api/list-users' && request.method === 'GET') {
      return handleListUsers(request, env);
    }

    if (url.pathname === '/api/delete-user' && request.method === 'DELETE') {
      return handleDeleteUser(request, env);
    }

    if (url.pathname === '/api/change-password' && request.method === 'POST') {
      return handleChangePassword(request, env);
    }

    if (url.pathname === '/api/toggle-ban' && request.method === 'POST') {
      return handleToggleBan(request, env);
    }

    // ── Static assets ──────────────────────────
    return env.ASSETS.fetch(request);
  },
};

/** Verifica que el request venga de un usuario autenticado con rol 'admin' */
async function verifyAdmin(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth) return false;

  // 1. Verificar JWT contra Supabase Auth
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: auth,
    },
  });
  if (!res.ok) return false;

  const user = await res.json();
  if (!user?.id) return false;

  // 2. Si el email coincide con el admin principal de Gmail, otorgar acceso
  if (user.email && user.email.toLowerCase().trim() === 'rubenmarchisio@gmail.com') {
    return true;
  }

  // 3. Verificar rol en la tabla user_roles
  const roleRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${user.id}&rol=eq.admin&select=rol`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    }
  );
  const roles = await roleRes.json();
  return Array.isArray(roles) && roles.length > 0;
}

// ── POST /api/create-user ──────────────────────
async function handleCreateUser(request, env) {
  if (!(await verifyAdmin(request, env))) {
    return json({ error: 'No autorizado como Administrador' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { email, password, rol, nombre } = body;
  if (!email || !password || !rol) {
    return json({ error: 'Email, contraseña y rol son obligatorios' }, 400);
  }
  if (!['admin', 'comercio', 'moto'].includes(rol)) {
    return json({ error: 'Rol inválido' }, 400);
  }

  // 1. Crear usuario en Supabase Auth
  const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        dni: body.dni || null,
        titular_nombre: body.titular_nombre || null,
        direccion: body.direccion || null,
        vehiculo: body.vehiculo || null,
      },
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    return json(
      { error: createData.message || createData.msg || 'Error al crear usuario en Supabase Auth' },
      400
    );
  }

  const userId = createData.id;

  // 2. Insertar rol en user_roles
  await fetch(`${env.SUPABASE_URL}/rest/v1/user_roles`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, rol }),
  });

  // 3. Si es comercio, crear registro en comercios
  if (rol === 'comercio' && nombre) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/comercios`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        nombre: nombre.trim(),
        rubro: body.rubro || 'otro',
        whatsapp: body.whatsapp ? body.whatsapp.trim() : '',
        activo: true,
        abierto: false,
        motivo_cierre: 'otro',
        mensaje_cierre: 'Configurando el local...',
      }),
    });
  }

  return json({ success: true, user_id: userId });
}

// ── GET /api/list-users ────────────────────────
async function handleListUsers(request, env) {
  if (!(await verifyAdmin(request, env))) {
    return json({ error: 'No autorizado' }, 403);
  }

  // Obtenemos los usuarios directamente de Auth para acceder a metadata y baneos
  const usersRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    },
  });

  if (!usersRes.ok) return json({ error: 'Error al listar usuarios' }, 500);

  const usersData = await usersRes.json();
  const authUsers = usersData.users || usersData || [];

  // Obtenemos los roles
  const rolesRes = await fetch(`${env.SUPABASE_URL}/rest/v1/user_roles?select=*`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    },
  });
  const roles = await rolesRes.json();
  const roleMap = {};
  if (Array.isArray(roles)) {
    roles.forEach((r) => (roleMap[r.user_id] = r.rol));
  }

  const data = authUsers.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    rol: roleMap[u.id] || (u.email === 'rubenmarchisio@gmail.com' ? 'admin' : 'cliente'),
    banned_until: u.banned_until,
    meta: u.raw_user_meta_data || {},
  }));

  return json(data);
}

// ── DELETE /api/delete-user ────────────────────
async function handleDeleteUser(request, env) {
  if (!(await verifyAdmin(request, env))) {
    return json({ error: 'No autorizado' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { user_id } = body;
  if (!user_id) return json({ error: 'user_id requerido' }, 400);

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    },
  });

  return json({ success: res.ok });
}

// ── PUT /api/change-password ────────────────────
async function handleChangePassword(request, env) {
  if (!(await verifyAdmin(request, env))) return json({ error: 'No autorizado' }, 403);

  const body = await request.json();
  if (!body.user_id || !body.password) return json({ error: 'Faltan datos' }, 400);

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${body.user_id}`, {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: body.password }),
  });

  return json({ success: res.ok });
}

// ── PUT /api/toggle-ban ────────────────────────
async function handleToggleBan(request, env) {
  if (!(await verifyAdmin(request, env))) return json({ error: 'No autorizado' }, 403);

  const body = await request.json();
  if (!body.user_id) return json({ error: 'Faltan datos' }, 400);

  const isBanned = body.ban;
  const ban_duration = isBanned ? '876000h' : 'none'; // 100 years or none

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${body.user_id}`, {
    method: 'PUT',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ban_duration }),
  });

  if (!res.ok) return json({ error: 'Error banning user' }, 500);

  // Desactivar o activar comercio
  await fetch(`${env.SUPABASE_URL}/rest/v1/comercios?user_id=eq.${body.user_id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ activo: !isBanned, abierto: false }), // Siempre forzamos cerrado al suspender
  });

  // Intentar desactivar moto también
  await fetch(`${env.SUPABASE_URL}/rest/v1/repartidores?user_id=eq.${body.user_id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ activo: !isBanned }),
  });

  return json({ success: true });
}
