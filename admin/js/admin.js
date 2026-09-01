/* =============================================
   Kiosco Digital — Panel Admin (entry point)
   Sistema de roles: admin | comercio | moto
   Un solo login → redirige según rol
   ============================================= */

/* global ADMIN_EMAIL */

import { supabase } from './supabase-client.js';
import { loadDashboard } from './dashboard.js';
import { initStock, loadStock } from './stock.js';
import { initPedidos, loadPedidos } from './pedidos.js';
import { initConfig, loadConfig } from './config-admin.js';
import { initUsuarios, loadUsuarios } from './usuarios.js';
import { initLiquidaciones, loadLiquidaciones } from './liquidaciones.js';
import { initCuentaComercio, loadCuentaComercio } from './cuenta-comercio.js';

// ── Estado global ──────────────────────────────
export let miRol = null; // 'admin' | 'comercio' | 'moto'
export let miComercio = null; // objeto de la tabla comercios (si rol=comercio)
export let miSession = null; // session de supabase

// ── DOM refs ───────────────────────────────────
const loginWrap = document.getElementById('login-wrap');
const adminLayout = document.getElementById('admin-layout');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSpinner = document.getElementById('login-spinner');
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// ── Auth ───────────────────────────────────────
supabase.auth.onAuthStateChange(async (_e, session) => {
  if (session) {
    miSession = session;
    await resolveRole(session.user);
  } else {
    miSession = null;
    showLogin();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  if (loginSpinner) loginSpinner.style.display = 'block';

  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (loginSpinner) loginSpinner.style.display = 'none';
  if (error) {
    loginError.textContent = 'Email o contraseña incorrectos';
    loginError.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  adminInitialized = false;
  miRol = null;
  miComercio = null;
  miSession = null;
  await supabase.auth.signOut();
});

// ── Resolución de rol ──────────────────────────
async function resolveRole(user) {
  let roleRow = null;

  try {
    // 1. Consultar tabla user_roles (maybeSingle no da error 406 si la fila no existe)
    const { data } = await supabase
      .from('user_roles')
      .select('rol')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) roleRow = data;
  } catch (e) {
    console.warn('Query user_roles warning:', e);
  }

  // 2. Fallback: si el email coincide con ADMIN_EMAIL, asignarle 'admin'
  const userEmail = (user.email || '').toLowerCase().trim();
  const adminEmail = (ADMIN_EMAIL || '').toLowerCase().trim();
  const rol = roleRow?.rol ?? (userEmail === adminEmail ? 'admin' : null);

  if (!rol) {
    // Sin rol asignado: mostrar error
    showLogin('Tu cuenta no tiene permisos. Contactá al administrador.');
    await supabase.auth.signOut();
    return;
  }

  miRol = rol;

  if (rol === 'moto') {
    // Redirigir al panel de moto
    window.location.href = '/moto';
    return;
  }

  if (rol === 'comercio') {
    // Cargar datos del comercio asociado
    const { data: comercio } = await supabase
      .from('comercios')
      .select('*')
      .eq('user_id', user.id)
      .single();
    miComercio = comercio || null;
  }

  showAdmin();
}

// ── Flag: evita init doble ─────────────────────
let adminInitialized = false;

// ── Mostrar vistas ─────────────────────────────
function showLogin(errorMsg) {
  loginWrap.style.display = 'flex';
  adminLayout.classList.remove('visible');
  if (errorMsg) {
    loginError.textContent = errorMsg;
    loginError.style.display = 'block';
  }
}

function showAdmin() {
  loginWrap.style.display = 'none';
  adminLayout.classList.add('visible');

  // Personalizar sidebar según rol
  updateSidebar();

  if (!adminInitialized) {
    adminInitialized = true;
    initStock();
    initPedidos();
    initConfig();
    if (miRol === 'admin') {
      initUsuarios();
      initLiquidaciones();
    }
    if (miRol === 'comercio') {
      initCuentaComercio();
    }
  }

  // Cargar pestaña inicial según el rol
  if (miRol === 'comercio') {
    document.querySelector('[data-page="page-stock"]')?.click();
  } else {
    document.querySelector('[data-page="page-dashboard"]')?.click();
  }
}

// ── Sidebar adaptado al rol ────────────────────
function updateSidebar() {
  // Badge del comercio activo
  const badgeEl = document.getElementById('sidebar-comercio');
  if (badgeEl) {
    if (miRol === 'admin') badgeEl.textContent = '👑 Administrador';
    else if (miComercio) badgeEl.textContent = `🏪 ${miComercio.nombre}`;
    else badgeEl.textContent = 'Mi local';
  }

  // Mostrar/ocultar tabs según rol
  const tabs = {
    'page-dashboard': miRol === 'admin',
    'page-stock': true, // Ambos
    'page-pedidos': miRol === 'admin',
    'page-config': true, // Ambos
    'page-usuarios': miRol === 'admin',
    'page-liquidacion': miRol === 'admin',
    'page-mi-cuenta': miRol === 'comercio',
    'page-qr': miRol === 'admin',
  };

  Object.entries(tabs).forEach(([page, visible]) => {
    const nav = document.querySelector(`[data-page="${page}"]`);
    if (nav) nav.style.display = visible ? 'flex' : 'none';
  });
}

// ── Navegación ─────────────────────────────────
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.page;
    pages.forEach((p) => (p.style.display = p.id === target ? 'block' : 'none'));
    if (target === 'page-stock') loadStock();
    if (target === 'page-pedidos') loadPedidos();
    if (target === 'page-config') loadConfig();
    if (target === 'page-dashboard') loadDashboard();
    if (target === 'page-usuarios') loadUsuarios();
    if (target === 'page-liquidacion') loadLiquidaciones();
    if (target === 'page-mi-cuenta') loadCuentaComercio();
  });
});
