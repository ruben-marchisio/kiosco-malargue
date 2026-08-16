/* =============================================
   Módulo home — Pantalla inicial: banners + grilla de categorías
   Máx. 300 líneas · Regla del proyecto
   ============================================= */

import { CATS, selectCategory } from './products.js';

// ── Banners: sistema extensible ───────────────
// 🔮 Punto de extensión para el futuro:
//    Reemplazar el return de DEFAULT_BANNERS por una llamada a Supabase:
//
//    import { supabase } from './api.js';
//    const { data } = await supabase
//      .from('banners')
//      .select('*')
//      .eq('activo', true)
//      .order('orden');
//    return data?.length ? data : DEFAULT_BANNERS;
//
// Estructura de cada banner:
// {
//   id: string,
//   title: string,
//   subtitle: string,
//   emoji: string,
//   bgFrom: string,   // color CSS (hex, hsl, etc.)
//   bgTo: string,
//   badge: string | null,
//   action: { type: 'category' | 'url', value: string } | null
// }

const DEFAULT_BANNERS = [
  {
    id: 'bienvenida',
    title: '¡Bienvenidos a El Pechito! 🎉',
    subtitle: 'Pedí desde casa y te lo llevamos a domicilio 🚴',
    emoji: '🛍️',
    bgFrom: '#FF6B35',
    bgTo: '#ff9a6c',
    badge: null,
    action: null,
  },
  {
    id: 'bebidas',
    title: '¡Bebidas frías para este frío!',
    subtitle: 'Mirá todas las opciones que tenemos para vos',
    emoji: '🥤',
    bgFrom: '#0ea5e9',
    bgTo: '#38bdf8',
    badge: 'Destacado',
    action: { type: 'category', value: 'bebidas' },
  },
];

// ── Estado del slider ─────────────────────────
let currentBannerIdx = 0;
let bannerTimer = null;
let bannerCount = 0;

// ── DOM refs ──────────────────────────────────
const homeView = document.getElementById('home-view');
const productsView = document.getElementById('products-view');

// ── API pública: vistas ───────────────────────
export function showHomeView() {
  homeView.style.display = 'block';
  productsView.style.display = 'none';
  document.getElementById('nav-home')?.classList.add('active');
  document.getElementById('nav-search')?.classList.remove('active');
  document.getElementById('nav-cart')?.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function showProductsView() {
  homeView.style.display = 'none';
  productsView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Carga de banners ──────────────────────────
export async function loadBanners() {
  // Aquí en el futuro se consultará Supabase (ver comentario arriba)
  return DEFAULT_BANNERS;
}

// ── Render banners ────────────────────────────
function renderBanners(banners) {
  const wrap = document.getElementById('banners-wrap');
  if (!wrap) return;
  bannerCount = banners.length;

  wrap.innerHTML = `
    <div class="banner-track" id="banner-track">
      ${banners
        .map(
          (b, i) => `
        <div class="banner-card ${i === 0 ? 'active' : ''}"
             style="--bg-from:${b.bgFrom};--bg-to:${b.bgTo};"
             data-action-type="${b.action?.type ?? ''}"
             data-action-value="${b.action?.value ?? ''}"
             role="${b.action ? 'button' : 'img'}"
             aria-label="${b.title}">
          <div class="banner-content">
            ${b.badge ? `<span class="banner-badge">${b.badge}</span>` : ''}
            <p class="banner-title">${b.title}</p>
            <p class="banner-subtitle">${b.subtitle}</p>
            ${b.action ? `<span class="banner-cta">Ver más →</span>` : ''}
          </div>
          <div class="banner-emoji-wrap" aria-hidden="true">${b.emoji}</div>
        </div>
      `
        )
        .join('')}
    </div>
    ${
      banners.length > 1
        ? `
      <div class="banner-dots" role="tablist" aria-label="Banners">
        ${banners
          .map(
            (_, i) => `
          <button class="banner-dot ${i === 0 ? 'active' : ''}"
                  data-idx="${i}"
                  role="tab"
                  aria-label="Banner ${i + 1}"
                  aria-selected="${i === 0}">
          </button>
        `
          )
          .join('')}
      </div>
    `
        : ''
    }
  `;

  wrap
    .querySelectorAll('.banner-card')
    .forEach((card) => card.addEventListener('click', () => handleBannerAction(card)));
  wrap
    .querySelectorAll('.banner-dot')
    .forEach((dot) =>
      dot.addEventListener('click', () => goToBanner(parseInt(dot.dataset.idx, 10)))
    );

  if (banners.length > 1) startBannerRotation();
}

function handleBannerAction(card) {
  const type = card.dataset.actionType;
  const value = card.dataset.actionValue;
  if (!type || !value) return;
  if (type === 'category') {
    const cat = CATS.find((c) => c.id === value);
    if (!cat) return;
    showProductsView();
    selectCategory(cat.id, `${cat.emoji} ${cat.label}`);
  }
  // Futuro: type === 'url' → window.location.href = value;
}

function goToBanner(idx) {
  document
    .querySelectorAll('.banner-card')
    .forEach((c, i) => c.classList.toggle('active', i === idx));
  document.querySelectorAll('.banner-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
    d.setAttribute('aria-selected', String(i === idx));
  });
  currentBannerIdx = idx;
}

function startBannerRotation() {
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => {
    goToBanner((currentBannerIdx + 1) % bannerCount);
  }, 5000);
}

// ── Render grilla de categorías ───────────────
function renderCategoryGrid() {
  const grid = document.getElementById('home-cats-grid');
  if (!grid) return;

  // Excluir "todo" — en la pantalla inicial navegamos por categorías específicas
  const cats = CATS.filter((c) => c.id !== 'todo');
  const featured = cats.filter((c) => c.featured);
  const regular = cats.filter((c) => !c.featured);

  const featuredHtml = featured
    .map(
      (cat) => `
      <button class="home-cat-card home-cat-featured" data-cat="${cat.id}" aria-label="Ver ${cat.label}">
        <span class="home-cat-emoji" aria-hidden="true">${cat.emoji}</span>
        <div class="home-cat-featured-texts">
          <span class="home-cat-featured-title">${cat.label.toUpperCase()}</span>
          <span class="home-cat-featured-sub">¡No te lo pierdas, aprovechá!</span>
        </div>
        <span class="home-cat-featured-arrow" aria-hidden="true">→</span>
      </button>
    `
    )
    .join('');

  const regularHtml = regular
    .map(
      (cat) => `
      <button class="home-cat-card" data-cat="${cat.id}" aria-label="Ver ${cat.label}">
        <span class="home-cat-emoji" aria-hidden="true">${cat.emoji}</span>
        <span class="home-cat-label">${cat.label}</span>
      </button>
    `
    )
    .join('');

  grid.innerHTML = featuredHtml + regularHtml;

  grid.querySelectorAll('.home-cat-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = CATS.find((c) => c.id === btn.dataset.cat);
      if (!cat) return;
      showProductsView();
      selectCategory(cat.id, `${cat.emoji} ${cat.label}`);
    });
  });
}

// ── Inicialización pública ────────────────────
export async function initHomeView() {
  const banners = await loadBanners();
  renderBanners(banners);
  renderCategoryGrid();
  showHomeView();
}
