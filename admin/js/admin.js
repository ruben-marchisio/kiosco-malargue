/* =============================================
   Kiosco Digital — Panel Admin (entry point)
   Orquesta: auth, navegación e inicialización
   ============================================= */

import { supabase } from './supabase-client.js';
import { loadDashboard } from './dashboard.js';
import { initStock, loadStock } from './stock.js';
import { initPedidos, loadPedidos } from './pedidos.js';
import { initConfig, loadConfig } from './config-admin.js';

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
  adminInitialized = false;
  await supabase.auth.signOut();
});

// Flag: evita que los init() se ejecuten más de una vez
// (onAuthStateChange se dispara en cada refresh de token de Supabase)
let adminInitialized = false;

function showLogin() {
  loginWrap.style.display = 'flex';
  adminLayout.classList.remove('visible');
}

function showAdmin() {
  loginWrap.style.display = 'none';
  adminLayout.classList.add('visible');
  if (!adminInitialized) {
    adminInitialized = true;
    initStock();
    initPedidos();
    initConfig();
  }
  loadDashboard();
}

// ── Navegación ────────────────────────────────
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
  });
});
