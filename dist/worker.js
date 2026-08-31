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

  // Consultar la vista o fallback a auth users
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/v_usuarios_con_rol?select=*&order=created_at.desc`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    }
  );

  let data = [];
  if (res.ok) {
    data = await res.json();
  } else {
    // Si la vista v_usuarios_con_rol aún no fue creada en SQL, traer auth users directamente
    const usersRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      data = (usersData.users || usersData || []).map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        rol: u.email === 'rubenmarchisio@gmail.com' ? 'admin' : 'comercio',
      }));
    }
  }

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
