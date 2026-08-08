/* =============================================
   Kiosco Digital — Corrector ortográfico
   Español (es) · nspell + dictionary-es CDN
   ============================================= */

const AFF_URL = 'https://cdn.jsdelivr.net/npm/dictionary-es@2/index.aff';
const DIC_URL = 'https://cdn.jsdelivr.net/npm/dictionary-es@2/index.dic';

// Marcas y términos propios de kiosco que no están en el diccionario
const WHITELIST = new Set([
  'coca',
  'pepsi',
  'sprite',
  'fanta',
  'manaos',
  'cunnington',
  'quilmes',
  'heineken',
  'stella',
  'artois',
  'lays',
  'oreo',
  'nestle',
  'arcor',
  'bagley',
  'georgalos',
  'kiosco',
  'delivery',
  'snack',
  'ml',
  'gr',
  'kg',
  'lt',
  'cc',
  'grs',
  'kcal',
]);

const EXTRA_WORDS = [
  'kiosco',
  'alfajor',
  'galletitas',
  'gaseosa',
  'medialunas',
  'chipá',
  'yerba',
  'delivery',
  'snack',
  'facturas',
  'bizcochos',
  'budín',
  'sándwich',
  'empanada',
  'milanesa',
  'lomito',
];

let checker = null;
let status = 'idle'; // idle | loading | ready | error
const timers = new WeakMap();

// ── Carga diferida ────────────────────────────
async function loadChecker() {
  if (status !== 'idle') return;
  status = 'loading';
  try {
    const [[aff, dic], { default: nspell }] = await Promise.all([
      Promise.all([fetch(AFF_URL).then((r) => r.text()), fetch(DIC_URL).then((r) => r.text())]),
      import('https://esm.sh/nspell@2'),
    ]);
    checker = nspell({ aff, dic });
    EXTRA_WORDS.forEach((w) => checker.add(w));
    status = 'ready';
    console.log('[spell] Corrector listo ✓');
  } catch (e) {
    console.warn('[spell] No disponible:', e.message);
    status = 'error';
  }
}

// ── Corrección de acento (paso prioritario) ───
// Genera variantes de la palabra reemplazando vocales/ñ por sus versiones acentuadas
const ACCENT_MAP = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', n: 'ñ' };

function accentVariants(word) {
  const lower = word.toLowerCase();
  const variants = [];
  for (let i = 0; i < lower.length; i++) {
    const acc = ACCENT_MAP[lower[i]];
    if (acc) {
      const v = lower.slice(0, i) + acc + lower.slice(i + 1);
      // Conservar mayúscula inicial si la había
      variants.push(word[0] === word[0].toUpperCase() ? v[0].toUpperCase() + v.slice(1) : v);
    }
  }
  return variants;
}

// ── Analizar texto → errores ──────────────────
function analyze(text) {
  if (!checker) return [];
  const matches = [...text.matchAll(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+/g)];
  const seen = new Set();
  const errors = [];

  for (const [word] of matches) {
    const lc = word.toLowerCase();
    if (lc.length <= 2 || WHITELIST.has(lc) || seen.has(lc)) continue;
    seen.add(lc);

    if (checker.correct(word) || checker.correct(lc)) continue;

    // 1. Intentar corrección por acento faltante primero
    const accentFix = accentVariants(word).find(
      (v) => checker.correct(v) || checker.correct(v.toLowerCase())
    );
    if (accentFix) {
      errors.push({ word, suggestions: [accentFix] });
      continue;
    }

    // 2. Fallback: sugerencias de nspell, filtradas por longitud similar
    const suggestions = checker
      .suggest(word)
      .filter((s) => Math.abs(s.length - word.length) <= 2)
      .slice(0, 3);
    if (suggestions.length) errors.push({ word, suggestions });
  }
  return errors;
}

// ── UI: elemento hint bajo el campo ──────────
function getHint(input) {
  const id = `sh-${input.id}`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'spell-hint';
    el.hidden = true;
    input.parentNode.insertBefore(el, input.nextSibling);
  }
  return el;
}

function renderHint(input, errors) {
  const hint = getHint(input);
  if (!errors.length) {
    hint.hidden = true;
    hint.innerHTML = '';
    return;
  }

  hint.hidden = false;
  hint.innerHTML =
    '<span class="spell-label">✏️ Posibles errores:</span> ' +
    errors
      .map(
        ({ word, suggestions }) =>
          `<span class="spell-group">"<em>${word}</em>" → ` +
          suggestions
            .map(
              (s) => `<button class="spell-sug" data-from="${word}" data-to="${s}">${s}</button>`
            )
            .join('') +
          '</span>'
      )
      .join(' · ');

  hint.querySelectorAll('.spell-sug').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const re = new RegExp(`\\b${btn.dataset.from}\\b`, 'gi');
      input.value = input.value.replace(re, (m) =>
        m[0] === m[0].toUpperCase()
          ? btn.dataset.to.charAt(0).toUpperCase() + btn.dataset.to.slice(1)
          : btn.dataset.to
      );
      input.dispatchEvent(new Event('input'));
    });
  });
}

// ── Adjuntar a un campo ───────────────────────
function attach(input) {
  // Cargar diccionario al primer foco
  input.addEventListener('focus', loadChecker, { once: true });

  input.addEventListener('input', () => {
    clearTimeout(timers.get(input));
    timers.set(
      input,
      setTimeout(async () => {
        if (status === 'idle') await loadChecker();
        if (status !== 'ready') return;
        renderHint(input, analyze(input.value));
      }, 700)
    );
  });

  // Ocultar hint 1.5s después de perder el foco
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!input.matches(':focus')) {
        const hint = getHint(input);
        hint.hidden = true;
        hint.innerHTML = '';
      }
    }, 1500);
  });
}

// ── API pública ───────────────────────────────
export function initSpellCheck(fieldIds) {
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) attach(el);
  });
}

/** Permite agregar una palabra al whitelist (ej: marcas cargadas desde la BD) */
export function addToWhitelist(word) {
  WHITELIST.add(word.toLowerCase());
  if (checker) checker.add(word);
}
