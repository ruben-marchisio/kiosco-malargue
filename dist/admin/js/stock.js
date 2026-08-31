/* =============================================
   Kiosco Digital — Stock & Productos
   Multi-tenant: filtra por comercio_id
   ============================================= */

import { supabase, CAT_EMOJI, fmt } from './supabase-client.js';
import { initSpellCheck, addToWhitelist } from './spell.js';
import { clearCatalogCache } from '../../js/cache.js';
import { miComercio } from './admin.js';

// ── State ─────────────────────────────────────
let allProducts = [];
let editingId = null;
const STORAGE_BUCKET = 'productos';
const SUPABASE_PROJECT_ID = 'nlnfkdrdssaaynlrnfpj';

// ── DOM refs ──────────────────────────────────
const modal = document.getElementById('product-modal');
const modalTitle = document.getElementById('modal-title');
const productForm = document.getElementById('product-form');
const csvModal = document.getElementById('csv-modal');
const csvFileInput = document.getElementById('csv-file-input');

// ── Cargar todos los productos ────────────────────────
export async function loadStock() {
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="table-placeholder">Cargando...</td></tr>';

  let query = supabase.from('productos').select('*').order('categoria').order('nombre');

  // Filtro multi-tenant: cada comercio ve solo sus productos
  if (miComercio) {
    query = query.eq('comercio_id', miComercio.id);
  }
  // Si esSuperAdmin sin comercio, ve todos (no se agrega filtro)

  const { data } = await query;
  allProducts = data || [];
  allProducts.forEach((p) => {
    if (p.marca) addToWhitelist(p.marca);
  });
  renderTable(allProducts);
}

// ── Renderizar tablas (disponibles / sin stock) ───
function renderTable(products) {
  const disponibles = products.filter((p) => p.disponible);
  const sinStock = products.filter((p) => !p.disponible);

  // Tabla de disponibles
  const tbody = document.getElementById('stock-tbody');
  tbody.innerHTML = disponibles.length
    ? disponibles.map(productRow).join('')
    : '<tr><td colspan="6" class="table-placeholder">Sin resultados</td></tr>';

  // Tabla de sin stock
  const sstbody = document.getElementById('sinstock-tbody');
  sstbody.innerHTML = sinStock.length
    ? sinStock.map(productRow).join('')
    : '<tr><td colspan="6" class="table-placeholder">Ningún producto sin stock 🎉</td></tr>';

  // Contadores
  document.getElementById('count-disponibles').textContent = disponibles.length;
  document.getElementById('count-sinstock').textContent = sinStock.length;

  // Card sin-stock: resaltar si hay productos ahí
  const cardSinstock = document.getElementById('card-sinstock');
  if (cardSinstock) cardSinstock.classList.toggle('has-items', sinStock.length > 0);

  // Registrar listeners en AMBAS tablas
  [tbody, sstbody].forEach((tb) => {
    tb.querySelectorAll('[data-toggle]').forEach((input) => {
      input.addEventListener('change', async () => {
        await supabase
          .from('productos')
          .update({ disponible: input.checked })
          .eq('id', input.dataset.toggle);
        const p = allProducts.find((x) => x.id === input.dataset.toggle);
        if (p) p.disponible = input.checked;
        // Re-renderizar para mover el producto entre secciones
        renderTable(getFiltered());
      });
    });

    tb.querySelectorAll('[data-edit]').forEach((btn) => {
      const prod = allProducts.find((p) => p.id === btn.dataset.edit);
      btn.addEventListener('click', () => openProductModal(prod));
    });

    tb.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este producto?')) return;
        await supabase.from('productos').delete().eq('id', btn.dataset.delete);
        clearCatalogCache(); // ← invalidar caché del catálogo público
        allProducts = allProducts.filter((p) => p.id !== btn.dataset.delete);
        renderTable(getFiltered());
      });
    });
  });
}

function productRow(p) {
  const thumb = p.imagen_url
    ? `<img src="${p.imagen_url}" alt="${p.nombre}">`
    : CAT_EMOJI[p.categoria] || '📦';
  return `
  <tr>
    <td>
      <div class="prod-name-cell">
        <div class="prod-thumb">${thumb}</div>
        <div>
          <div style="font-weight:600">${p.nombre}</div>
          ${p.es_tercero ? `<div class="prod-sub">Vecino: ${p.proveedor_nombre || '—'}</div>` : ''}
        </div>
      </div>
    </td>
    <td>${p.marca ? `<span class="brand-badge">${p.marca}</span>` : '<span class="text-muted">—</span>'}</td>
    <td><span class="cat-badge">${p.categoria}</span></td>
    <td class="price-cell">$${fmt(p.precio)}</td>
    <td>
      <label class="toggle">
        <input type="checkbox" ${p.disponible ? 'checked' : ''} data-toggle="${p.id}">
        <span class="toggle-slider"></span>
      </label>
    </td>
    <td>
      <button class="btn btn-sm btn-primary" data-edit="${p.id}">✏️</button>
      <button class="btn btn-sm btn-danger" data-delete="${p.id}" style="margin-left:4px">🗑️</button>
    </td>
  </tr>`;
}

// ── Title Case automático ────────────────────
function titleCase(str) {
  return str.replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function attachTitleCase(el) {
  el.addEventListener('input', () => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = titleCase(el.value);
    el.setSelectionRange(start, end);
  });
}

// ── Búsqueda + filtro por categoría ──────────────
function getFiltered() {
  const q = (document.getElementById('stock-search')?.value || '').toLowerCase().trim();
  const cat = (document.getElementById('stock-cat-filter')?.value || '').toLowerCase();
  return allProducts.filter((p) => {
    const matchesText =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.marca || '').toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q);
    const matchesCat = !cat || p.categoria === cat;
    return matchesText && matchesCat;
  });
}

// ── Conversión WebP + subida a Storage ───────
/**
 * Toma un File de imagen, lo redimensiona a máx 400×400px,
 * lo convierte a WebP (calidad 0.80) y lo sube al bucket.
 * Devuelve la URL pública o lanza un error.
 */
async function uploadImageToStorage(file) {
  // 1. Leer el archivo y cargar en un elemento Image
  const bitmap = await createImageBitmap(file);
  const MAX = 400;
  let { width, height } = bitmap;
  if (width > MAX || height > MAX) {
    const ratio = Math.min(MAX / width, MAX / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // 2. Dibujar en canvas y exportar como WebP
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

  const webpBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));

  // 3. Nombre único para el archivo en el bucket
  const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;

  // 4. Subir a Supabase Storage
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, webpBlob, { contentType: 'image/webp', upsert: false });

  if (error) throw new Error(error.message);

  // 5. Construir URL pública
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
}

/** Muestra u oculta el preview de imagen en el modal */
function setImagePreview(url) {
  const previewWrap = document.getElementById('imagen-preview-wrap');
  const previewImg = document.getElementById('imagen-preview');
  if (url) {
    previewImg.src = url;
    previewWrap.style.display = 'flex';
  } else {
    previewImg.src = '';
    previewWrap.style.display = 'none';
  }
}

// ── Modal producto ────────────────────────────
function openProductModal(prod) {
  editingId = prod?.id || null;
  modalTitle.textContent = prod ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('f-nombre').value = prod?.nombre || '';
  document.getElementById('f-marca').value = prod?.marca || '';
  document.getElementById('f-descripcion').value = prod?.descripcion || '';
  document.getElementById('f-categoria').value = prod?.categoria || 'otros';
  document.getElementById('f-precio').value = prod?.precio || '';
  document.getElementById('f-imagen').value = prod?.imagen_url || '';
  document.getElementById('f-tercero').checked = prod?.es_tercero || false;
  document.getElementById('f-proveedor').value = prod?.proveedor_nombre || '';
  document.getElementById('f-disponible').checked = prod?.disponible ?? true;
  // Reset estado de imagen
  document.getElementById('f-imagen-file').value = '';
  document.getElementById('imagen-upload-status').style.display = 'none';
  setImagePreview(prod?.imagen_url || '');
  modal.classList.add('open');
  document.getElementById('f-nombre').focus();
}

function closeProductModal() {
  modal.classList.remove('open');
  editingId = null;
}

// ── CSV: constantes ───────────────────────────
const VALID_CATS = new Set([
  'combos',
  'bebidas',
  'alcohol',
  'snacks',
  'comidas',
  'panaderia',
  'almacen',
  'verduleria',
  'limpieza',
  'higiene',
  'cigarrillos',
  'mascota',
  'libreria',
  'otros',
]);
const CSV_TEMPLATE =
  'nombre,marca,categoria,precio,descripcion\n' +
  'Coca Cola 500ml,Coca-Cola,bebidas,1500,\n' +
  "Papas Lay's Sal,Lay's,snacks,800,";

// ── CSV: parsear archivo ──────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['Archivo vacío o sin datos'] };

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows = [];
  const errors = [];

  lines.slice(1).forEach((line, i) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    header.forEach((h, j) => (row[h] = vals[j] || ''));

    if (!row.nombre) {
      errors.push(`Fila ${i + 2}: falta el nombre`);
      return;
    }
    const precio = parseFloat(row.precio);
    if (!precio || precio <= 0) {
      errors.push(`Fila ${i + 2}: precio inválido en "${row.nombre}"`);
      return;
    }
    const cat = (row.categoria || '').toLowerCase();

    rows.push({
      nombre: titleCase(row.nombre),
      marca: row.marca ? titleCase(row.marca) : null,
      categoria: VALID_CATS.has(cat) ? cat : 'otros',
      precio,
      descripcion: row.descripcion || null,
      disponible: true,
    });
  });
  return { rows, errors };
}

function showCSVPreview(text) {
  const { rows, errors } = parseCSV(text);
  const preview = document.getElementById('csv-preview');
  let html = '';

  if (errors.length) {
    html += `<div class="csv-errors">${errors.map((e) => `<div>⚠️ ${e}</div>`).join('')}</div>`;
  }
  if (rows.length) {
    html += `<p class="csv-count">✅ ${rows.length} producto${rows.length > 1 ? 's' : ''} listo${rows.length > 1 ? 's' : ''} para importar</p>`;
    html += `<div class="csv-table-wrap"><table class="prod-table">
      <thead><tr><th>Nombre</th><th>Marca</th><th>Categoría</th><th>Precio</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${r.nombre}</td><td>${r.marca || '—'}</td><td>${r.categoria}</td><td>$${fmt(r.precio)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  } else if (!errors.length) {
    html = '<p class="table-placeholder">Sin datos válidos</p>';
  }

  preview.innerHTML = html;
  const btn = document.getElementById('csv-confirm-btn');
  btn.dataset.rows = JSON.stringify(rows);
  btn.disabled = !rows.length;
}

// ── Init: registra todos los listeners ────────
export function initStock() {
  // Title Case en nombre y marca
  attachTitleCase(document.getElementById('f-nombre'));
  attachTitleCase(document.getElementById('f-marca'));

  // Corrector ortográfico en campos de texto libre
  initSpellCheck(['f-nombre', 'f-descripcion', 'p-notas']);

  // Modal producto
  document
    .getElementById('add-product-btn')
    .addEventListener('click', () => openProductModal(null));
  document.getElementById('modal-close').addEventListener('click', closeProductModal);
  document.getElementById('modal-cancel').addEventListener('click', closeProductModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeProductModal();
  });

  // Preview al escribir URL manualmente
  document.getElementById('f-imagen').addEventListener('input', (e) => {
    setImagePreview(e.target.value.trim());
  });

  // Quitar imagen
  document.getElementById('imagen-remove').addEventListener('click', () => {
    document.getElementById('f-imagen').value = '';
    document.getElementById('f-imagen-file').value = '';
    setImagePreview('');
  });

  // Subida de imagen desde PC
  document.getElementById('f-imagen-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('imagen-upload-status');
    statusEl.textContent = '⏳ Convirtiendo y subiendo imagen...';
    statusEl.style.display = 'block';
    statusEl.className = 'upload-status uploading';
    try {
      const url = await uploadImageToStorage(file);
      document.getElementById('f-imagen').value = url;
      setImagePreview(url);
      statusEl.textContent = '✅ Imagen subida correctamente';
      statusEl.className = 'upload-status success';
    } catch (err) {
      statusEl.textContent = `❌ Error al subir: ${err.message}`;
      statusEl.className = 'upload-status error';
    }
  });

  // Buscador y filtro por categoría
  document
    .getElementById('stock-search')
    .addEventListener('input', () => renderTable(getFiltered()));
  document
    .getElementById('stock-cat-filter')
    .addEventListener('change', () => renderTable(getFiltered()));

  // Guardar producto
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = productForm.querySelector('[type="submit"]');
    btn.disabled = true;
    const payload = {
      nombre: titleCase(document.getElementById('f-nombre').value.trim()),
      marca: titleCase(document.getElementById('f-marca').value.trim()) || null,
      descripcion: document.getElementById('f-descripcion').value.trim() || null,
      categoria: document.getElementById('f-categoria').value,
      precio: parseFloat(document.getElementById('f-precio').value),
      imagen_url: document.getElementById('f-imagen').value.trim() || null,
      es_tercero: document.getElementById('f-tercero').checked,
      proveedor_nombre: document.getElementById('f-proveedor').value.trim() || null,
      disponible: document.getElementById('f-disponible').checked,
      comercio_id: miComercio?.id || null, // ← asignar al comercio activo
    };
    if (editingId) await supabase.from('productos').update(payload).eq('id', editingId);
    else await supabase.from('productos').insert(payload);
    clearCatalogCache(); // ← invalidar caché del catálogo público
    btn.disabled = false;
    closeProductModal();
    await loadStock();
  });

  // CSV — abrir modal
  document.getElementById('import-csv-btn').addEventListener('click', () => {
    document.getElementById('csv-preview').innerHTML = '';
    document.getElementById('csv-confirm-btn').disabled = true;
    csvFileInput.value = '';
    csvModal.classList.add('open');
  });
  document
    .getElementById('csv-modal-close')
    .addEventListener('click', () => csvModal.classList.remove('open'));
  document
    .getElementById('csv-modal-close-footer')
    .addEventListener('click', () => csvModal.classList.remove('open'));
  csvModal.addEventListener('click', (e) => {
    if (e.target === csvModal) csvModal.classList.remove('open');
  });

  // CSV — descargar plantilla
  document.getElementById('csv-template-btn').addEventListener('click', () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'plantilla_productos.csv',
    });
    a.click();
  });

  // CSV — seleccionar archivo
  csvFileInput.addEventListener('change', () => {
    const file = csvFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => showCSVPreview(e.target.result);
    reader.readAsText(file, 'UTF-8');
  });

  // CSV — confirmar importación
  document.getElementById('csv-confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('csv-confirm-btn');
    const rows = JSON.parse(btn.dataset.rows || '[]');
    if (!rows.length) return;
    btn.disabled = true;
    btn.textContent = 'Importando...';
    const { error } = await supabase.from('productos').insert(rows);
    if (error) {
      alert('Error al importar: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Importar productos';
    } else {
      clearCatalogCache(); // ← invalidar caché del catálogo público
      csvModal.classList.remove('open');
      await loadStock();
      alert(
        `✅ ${rows.length} producto${rows.length > 1 ? 's' : ''} importado${rows.length > 1 ? 's' : ''} correctamente`
      );
    }
  });
}
