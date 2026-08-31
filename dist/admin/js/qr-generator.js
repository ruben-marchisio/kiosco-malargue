/**
 * qr-generator.js — Generador de flyer QR para imprimir / guardar como PDF
 * El Pechito · Kiosco Digital · Malargüe
 */

/* ── Constantes del negocio ── */
const CONTACT_NAME = 'Ruben Marchisio';
const CONTACT_PHONE = '2604055198';
const CONTACT_WA = '5492604055198';
const BRAND = 'El Pechito';
const TAGLINE = 'Tu kiosco de barrio online · Malargüe';
const EMOJI_BRAND = '🏪';

/* ── Dimensiones de flyer por tamaño ── */
const SIZES = {
  A4: { width: 794, height: 1123, label: 'A4', qrSize: 280 },
  A5: { width: 559, height: 794, label: 'A5', qrSize: 200 },
  '10x15': { width: 378, height: 567, label: '10×15 cm', qrSize: 160 },
};

/* ── Referencias DOM ── */
const generateBtn = document.getElementById('qr-generate-btn');
const printBtn = document.getElementById('qr-print-btn');
const previewWrap = document.getElementById('qr-preview-wrap');
const flyerContainer = document.getElementById('qr-flyer-container');
const urlInput = document.getElementById('qr-url');
const sizeSelect = document.getElementById('qr-size');
const copiesInput = document.getElementById('qr-copies');
const bgColorInput = document.getElementById('qr-bg-color');
const presetColorSelect = document.getElementById('qr-preset-color');
const cardsBtn = document.getElementById('qr-cards-btn');

/* ── Sincronizar selector de presets con color picker ── */
presetColorSelect?.addEventListener('change', () => {
  const v = presetColorSelect.value;
  if (v && v !== '__bw__' && bgColorInput) bgColorInput.value = v;
});
bgColorInput?.addEventListener('input', () => {
  if (presetColorSelect) presetColorSelect.value = '';
});

/* ── Genera el flyer en el DOM ── */
function buildFlyer(url, sizeKey, bgColor) {
  const cfg = SIZES[sizeKey] || SIZES['A4'];
  const isBW = bgColor === '__bw__';

  /* Limpiar contenedor previo */
  flyerContainer.innerHTML = '';

  /* Wrapper escalado para preview */
  const scale = Math.min(1, 560 / cfg.width);
  const wrapper = document.createElement('div');
  wrapper.id = 'qr-flyer';
  wrapper.style.cssText = `
    width: ${cfg.width}px;
    height: ${cfg.height}px;
    transform: scale(${scale});
    transform-origin: top center;
    margin-bottom: ${cfg.height * (scale - 1)}px;
  `;

  wrapper.innerHTML = isBW ? flyerBWHTML(url, cfg) : flyerHTML(url, cfg, bgColor);
  flyerContainer.appendChild(wrapper);

  /* Generar QR dentro del flyer */
  const qrTarget = wrapper.querySelector('#qr-code-canvas');
  if (qrTarget) {
    new QRCode(qrTarget, {
      text: url,
      width: cfg.qrSize,
      height: cfg.qrSize,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
}

/* ── Template HTML del flyer ── */
function flyerHTML(url, cfg, bgColor) {
  const isDark = isDarkColor(bgColor);
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const subtleColor = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)';
  const accentColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
  const qrBorder = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';
  const badgeBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
  const badgeBorder = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';

  /* Ajuste de tamaños tipográficos según tamaño de flyer */
  const scale = cfg.width / 794;
  const fs = (n) => Math.round(n * scale) + 'px';

  return `
  <div style="
    width:100%; height:100%;
    background: linear-gradient(145deg, ${bgColor} 0%, ${shiftColor(bgColor, -25)} 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    padding: ${fs(40)} ${fs(36)} ${fs(32)};
    box-sizing: border-box;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    position: relative;
    overflow: hidden;
  ">

    <!-- Decoración fondo: círculos sutiles -->
    <div style="
      position:absolute; top:-${fs(80)}; right:-${fs(80)};
      width:${fs(320)}; height:${fs(320)};
      border-radius:50%;
      background: ${accentColor};
      pointer-events:none;
    "></div>
    <div style="
      position:absolute; bottom:-${fs(60)}; left:-${fs(60)};
      width:${fs(240)}; height:${fs(240)};
      border-radius:50%;
      background: ${accentColor};
      pointer-events:none;
    "></div>

    <!-- ── HEADER ── -->
    <div style="text-align:center; z-index:1; width:100%">

      <!-- Badge superior -->
      <div style="
        display:inline-flex; align-items:center; gap:${fs(6)};
        background:${badgeBg}; border:1px solid ${badgeBorder};
        border-radius:${fs(50)}; padding:${fs(6)} ${fs(16)};
        margin-bottom:${fs(20)};
      ">
        <span style="font-size:${fs(11)}; color:${subtleColor}; font-weight:600; text-transform:uppercase; letter-spacing:1.5px">
          📲 Escaneá y pedí desde casa
        </span>
      </div>

      <!-- Logo / Emoji grande -->
      <div style="
        font-size:${fs(80)}; line-height:1;
        margin-bottom:${fs(8)};
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
      ">${EMOJI_BRAND}</div>

      <!-- Nombre del negocio -->
      <h1 style="
        font-size:${fs(52)}; font-weight:900;
        color:${textColor}; margin:0 0 ${fs(6)};
        letter-spacing:-1px; line-height:1;
        text-shadow: 0 2px 8px rgba(0,0,0,0.25);
      ">${BRAND}</h1>

      <!-- Tagline -->
      <p style="
        font-size:${fs(17)}; color:${subtleColor};
        margin:0 0 ${fs(30)}; font-weight:500;
        letter-spacing:0.3px;
      ">${TAGLINE}</p>

      <!-- Separador decorativo -->
      <div style="
        width:${fs(60)}; height:3px;
        background: ${textColor};
        opacity:0.35; border-radius:2px;
        margin: 0 auto ${fs(28)};
      "></div>
    </div>

    <!-- ── QR CODE ── -->
    <div style="z-index:1; text-align:center">
      <div style="
        background:#fff;
        border-radius:${fs(20)};
        padding:${fs(18)};
        box-shadow: 0 8px 32px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.15);
        border: 4px solid ${qrBorder};
        display:inline-block;
      ">
        <div id="qr-code-canvas"></div>
      </div>

      <!-- Texto debajo del QR -->
      <p style="
        margin-top:${fs(14)}; font-size:${fs(13)};
        color:${subtleColor}; font-weight:600;
        text-transform: uppercase; letter-spacing: 1.2px;
      ">⬆ Apuntá la cámara aquí</p>
    </div>

    <!-- ── FEATURES ── -->
    <div style="
      z-index:1; width:100%;
      display:flex; justify-content:center; gap:${fs(12)};
      flex-wrap:wrap; margin: ${fs(24)} 0;
    ">
      ${featureBadge('🛒', 'Pedí sin salir', fs, badgeBg, badgeBorder, textColor)}
      ${featureBadge('🛵', 'Delivery rápido', fs, badgeBg, badgeBorder, textColor)}
      ${featureBadge('💳', 'Varios medios de pago', fs, badgeBg, badgeBorder, textColor)}
    </div>

    <!-- ── URL VISIBLE ── -->
    <div style="
      z-index:1; width:100%; text-align:center;
      background:${accentColor};
      border-radius:${fs(10)};
      padding:${fs(10)} ${fs(16)};
      margin-bottom:${fs(16)};
    ">
      <p style="margin:0; font-size:${fs(13)}; color:${subtleColor}; font-weight:600; letter-spacing:0.5px; word-break:break-all">
        🌐 ${url}
      </p>
    </div>

    <!-- ── FOOTER CONTACTO ── -->
    <div style="
      z-index:1; width:100%; text-align:center;
      border-top: 1px solid ${badgeBorder};
      padding-top:${fs(16)};
    ">
      <p style="margin:0 0 ${fs(4)}; font-size:${fs(14)}; color:${textColor}; font-weight:700">
        👤 ${CONTACT_NAME}
      </p>
      <p style="margin:0; font-size:${fs(13)}; color:${subtleColor}; font-weight:500">
        📞 ${CONTACT_PHONE} &nbsp;·&nbsp; 💬 WhatsApp disponible
      </p>
    </div>

  </div>`;
}

/* ── Template HTML del flyer Blanco y Negro ── */
function flyerBWHTML(url, cfg) {
  const scale = cfg.width / 794;
  const fs = (n) => Math.round(n * scale) + 'px';

  return `
  <div style="
    width:100%; height:100%;
    background: #ffffff;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    padding: ${fs(40)} ${fs(36)} ${fs(32)};
    box-sizing: border-box;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    position: relative;
    overflow: hidden;
    border: 3px solid #000000;
  ">

    <!-- Decoración: líneas de corte en esquinas -->
    <div style="position:absolute;top:${fs(10)};left:${fs(10)};width:${fs(24)};height:2px;background:#000"></div>
    <div style="position:absolute;top:${fs(10)};left:${fs(10)};width:2px;height:${fs(24)};background:#000"></div>
    <div style="position:absolute;top:${fs(10)};right:${fs(10)};width:${fs(24)};height:2px;background:#000"></div>
    <div style="position:absolute;top:${fs(10)};right:${fs(10)};width:2px;height:${fs(24)};background:#000"></div>
    <div style="position:absolute;bottom:${fs(10)};left:${fs(10)};width:${fs(24)};height:2px;background:#000"></div>
    <div style="position:absolute;bottom:${fs(10)};left:${fs(10)};width:2px;height:${fs(24)};background:#000"></div>
    <div style="position:absolute;bottom:${fs(10)};right:${fs(10)};width:${fs(24)};height:2px;background:#000"></div>
    <div style="position:absolute;bottom:${fs(10)};right:${fs(10)};width:2px;height:${fs(24)};background:#000"></div>

    <!-- ── HEADER ── -->
    <div style="text-align:center; z-index:1; width:100%">

      <!-- Badge superior -->
      <div style="
        display:inline-flex; align-items:center; gap:${fs(6)};
        background:#000000; border-radius:${fs(4)};
        padding:${fs(5)} ${fs(16)}; margin-bottom:${fs(20)};
      ">
        <span style="font-size:${fs(11)}; color:#ffffff; font-weight:700; text-transform:uppercase; letter-spacing:2px">
          📲 Escaneá y pedí desde casa
        </span>
      </div>

      <!-- Logo / Emoji grande -->
      <div style="
        font-size:${fs(80)}; line-height:1;
        margin-bottom:${fs(8)};
      ">${EMOJI_BRAND}</div>

      <!-- Nombre del negocio -->
      <h1 style="
        font-size:${fs(52)}; font-weight:900;
        color:#000000; margin:0 0 ${fs(6)};
        letter-spacing:-1px; line-height:1;
      ">${BRAND}</h1>

      <!-- Tagline -->
      <p style="
        font-size:${fs(17)}; color:#333333;
        margin:0 0 ${fs(30)}; font-weight:500;
        letter-spacing:0.3px;
      ">${TAGLINE}</p>

      <!-- Separador decorativo -->
      <div style="
        width:100%; height:2px;
        background: #000000;
        margin: 0 auto ${fs(28)};
      "></div>
    </div>

    <!-- ── QR CODE ── -->
    <div style="z-index:1; text-align:center">
      <div style="
        background:#fff;
        border-radius:${fs(8)};
        padding:${fs(18)};
        border: 3px solid #000000;
        display:inline-block;
      ">
        <div id="qr-code-canvas"></div>
      </div>

      <!-- Texto debajo del QR -->
      <p style="
        margin-top:${fs(14)}; font-size:${fs(13)};
        color:#000000; font-weight:700;
        text-transform: uppercase; letter-spacing: 1.5px;
      ">⬆ Apuntá la cámara aquí</p>
    </div>

    <!-- ── FEATURES ── -->
    <div style="
      z-index:1; width:100%;
      display:flex; justify-content:center; gap:${fs(12)};
      flex-wrap:wrap; margin: ${fs(24)} 0;
    ">
      ${featureBadgeBW('🛒', 'Pedí sin salir', fs)}
      ${featureBadgeBW('🛵', 'Delivery rápido', fs)}
      ${featureBadgeBW('💳', 'Varios medios de pago', fs)}
    </div>

    <!-- ── URL VISIBLE ── -->
    <div style="
      z-index:1; width:100%; text-align:center;
      background:#f0f0f0;
      border-radius:${fs(4)};
      border: 1px solid #cccccc;
      padding:${fs(10)} ${fs(16)};
      margin-bottom:${fs(16)};
    ">
      <p style="margin:0; font-size:${fs(13)}; color:#222222; font-weight:600; letter-spacing:0.5px; word-break:break-all">
        🌐 ${url}
      </p>
    </div>

    <!-- ── FOOTER CONTACTO ── -->
    <div style="
      z-index:1; width:100%; text-align:center;
      border-top: 2px solid #000000;
      padding-top:${fs(16)};
    ">
      <p style="margin:0 0 ${fs(4)}; font-size:${fs(14)}; color:#000000; font-weight:700">
        👤 ${CONTACT_NAME}
      </p>
      <p style="margin:0; font-size:${fs(13)}; color:#444444; font-weight:500">
        📞 ${CONTACT_PHONE} &nbsp;·&nbsp; 💬 WhatsApp disponible
      </p>
    </div>

  </div>`;
}

function featureBadgeBW(icon, text, fs) {
  return `
    <div style="
      display:inline-flex; align-items:center; gap:${fs(5)};
      background:#f0f0f0; border:1.5px solid #000000;
      border-radius:${fs(4)}; padding:${fs(7)} ${fs(14)};
    ">
      <span style="font-size:${fs(15)}">${icon}</span>
      <span style="font-size:${fs(12)}; color:#000000; font-weight:700">${text}</span>
    </div>`;
}

function featureBadge(icon, text, fs, bg, border, color) {
  return `
    <div style="
      display:inline-flex; align-items:center; gap:${fs(5)};
      background:${bg}; border:1px solid ${border};
      border-radius:${fs(40)}; padding:${fs(7)} ${fs(14)};
    ">
      <span style="font-size:${fs(15)}">${icon}</span>
      <span style="font-size:${fs(12)}; color:${color}; font-weight:600">${text}</span>
    </div>`;
}

/* ── Helpers de color ── */
function isDarkColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function shiftColor(hex, amount) {
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + amount);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + amount);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/* ── GENERAR ── */
generateBtn?.addEventListener('click', () => {
  const url = urlInput?.value?.trim() || 'https://kiosco-malargue.pages.dev';
  const sizeKey = sizeSelect?.value || 'A4';
  const preset = presetColorSelect?.value;
  const bgColor = (preset && preset !== '') ? preset : (bgColorInput?.value || '#FF6B35');

  buildFlyer(url, sizeKey, bgColor);
  previewWrap.style.display = 'block';
  previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  printBtn.disabled = false;
  cardsBtn.disabled = false;
});

/* ── IMPRIMIR / PDF ── */
printBtn?.addEventListener('click', () => {
  const url = urlInput?.value?.trim() || 'https://kiosco-malargue.pages.dev';
  const sizeKey = sizeSelect?.value || 'A4';
  const preset = presetColorSelect?.value;
  const bgColor = (preset && preset !== '') ? preset : (bgColorInput?.value || '#FF6B35');
  const isBW = bgColor === '__bw__';
  const copies = parseInt(copiesInput?.value || '1', 10);
  const cfg = SIZES[sizeKey] || SIZES['A4'];

  /* Obtener el HTML del QR ya generado (con el canvas/img real) */
  const flyerEl = document.getElementById('qr-flyer');

  /* Convertir el canvas QR a imagen base64 para que se imprima */
  const canvas = flyerEl?.querySelector('canvas');
  let qrDataUrl = '';
  if (canvas) qrDataUrl = canvas.toDataURL('image/png');

  /* Construir HTML para la ventana de impresión */
  const flyerBody = isBW ? flyerBWHTML(url, cfg) : flyerHTML(url, cfg, bgColor);

  let pagesHTML = '';
  for (let i = 0; i < copies; i++) {
    pagesHTML += `
      <div class="print-page" style="
        width:${cfg.width}px; height:${cfg.height}px;
        page-break-after: ${i < copies - 1 ? 'always' : 'avoid'};
        position:relative; overflow:hidden;
      ">
        ${flyerBody.replace('<div id="qr-code-canvas"></div>',
          `<img src="${qrDataUrl}" width="${cfg.qrSize}" height="${cfg.qrSize}" style="display:block" />`
        )}
      </div>
    `;
  }

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8"/>
  <title>Flyer QR — ${BRAND}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#fff; }
    @page {
      size: ${sizeKey === 'A4' ? 'A4' : sizeKey === 'A5' ? 'A5' : '10cm 15cm'} portrait;
      margin: 0;
    }
    @media print {
      body { background: transparent; }
      .print-page { page-break-after: always; }
      .print-page:last-child { page-break-after: avoid; }
    }
    .no-print {
      text-align:center; padding:24px; font-family:system-ui;
      background:#f5f5f5;
    }
    .no-print button {
      background:#FF6B35; color:#fff; border:none;
      padding:12px 28px; border-radius:8px; font-size:16px;
      cursor:pointer; margin:0 8px; font-weight:600;
    }
    .no-print button.sec { background:#555; }
  </style>
</head>
<body>
  <div class="no-print" id="print-bar">
    <p style="margin-bottom:12px;font-size:14px;color:#555">
      🖨️ <strong>${copies} flyer${copies > 1 ? 's' : ''}</strong> listo${copies > 1 ? 's' : ''} para imprimir · Tamaño ${cfg.label}
    </p>
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
    <button class="sec" onclick="window.close()">✕ Cerrar</button>
  </div>
  ${pagesHTML}
  <script>
    window.onafterprint = function() { document.getElementById('print-bar').style.display='flex'; }
    document.getElementById('print-bar').style.display='flex';
    document.getElementById('print-bar').style.justifyContent='center';
    document.getElementById('print-bar').style.flexDirection='column';
    document.getElementById('print-bar').style.alignItems='center';
  <\/script>
</body>
</html>`);
  win.document.close();
});

/* ── IMPRIMIR TARJETAS ── */
cardsBtn?.addEventListener('click', () => {
  const url = urlInput?.value?.trim() || 'https://kiosco-malargue.pages.dev';
  const preset = presetColorSelect?.value;
  const bgColor = (preset && preset !== '') ? preset : (bgColorInput?.value || '#FF6B35');
  const isBW = bgColor === '__bw__';

  /* Reutilizar el QR ya generado en el preview */
  const flyerEl = document.getElementById('qr-flyer');
  const canvas = flyerEl?.querySelector('canvas');
  let qrDataUrl = '';
  if (canvas) qrDataUrl = canvas.toDataURL('image/png');

  const win = window.open('', '_blank', 'width=900,height=760');
  win.document.write(cardsPageHTML(url, bgColor, isBW, qrDataUrl));
  win.document.close();
});

function cardsPageHTML(url, bgColor, isBW, qrDataUrl) {
  const darkCard   = !isBW && isDarkColor(bgColor);
  const cardBg     = isBW
    ? '#ffffff'
    : 'linear-gradient(135deg, ' + bgColor + ' 0%, ' + shiftColor(bgColor, -35) + ' 100%)';
  const textColor  = isBW ? '#000000' : (darkCard ? '#ffffff' : '#1a1a1a');
  const muteColor  = isBW ? '#555555' : (darkCard ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.62)');
  const qrWrapBg   = '#ffffff';
  const qrWrapBrd  = isBW ? '2px solid #000000' : '2px solid rgba(255,255,255,0.55)';
  const badgeBg    = isBW ? '#000000'  : (darkCard ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)');
  const badgeTxt   = isBW ? '#ffffff'  : textColor;
  const accentLine = isBW ? '#000000'  : (darkCard ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)');

  /* Una sola tarjeta */
  const card = `
    <div class="cell">
      <div class="tarjeta" style="background:${cardBg};">

        <!-- columna izquierda -->
        <div class="col-left">
          <div class="badge" style="background:${badgeBg}">
            <span style="color:${badgeTxt};font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.2px">&#128242; Pedí online</span>
          </div>
          <div class="brand" style="color:${textColor}">${EMOJI_BRAND} ${BRAND}</div>
          <div class="tagline" style="color:${muteColor}">${TAGLINE}</div>
          <div class="divider" style="background:${accentLine}"></div>
          <div class="contact" style="color:${muteColor}">&#128222; ${CONTACT_PHONE} &nbsp;&middot;&nbsp; &#128172; WhatsApp</div>
          <div class="url-txt" style="color:${muteColor}">&#127760; ${url}</div>
        </div>

        <!-- columna derecha: QR -->
        <div class="col-right">
          <div class="qr-wrap" style="background:${qrWrapBg};border:${qrWrapBrd}">
            <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          </div>
          <div class="scan-lbl" style="color:${muteColor}">⬆ Escaneá</div>
        </div>

      </div>
    </div>`;

  const grid = Array(10).fill(card).join('');

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8"/>
  <title>Tarjetas QR — ${BRAND}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#e8e8e8; font-family:'Segoe UI',system-ui,sans-serif; }

    /* ─ Barra superior (no se imprime) ─ */
    .topbar {
      background:#fff; border-bottom:1px solid #ddd;
      padding:16px 24px; text-align:center;
    }
    .topbar p { font-size:14px; color:#555; margin-bottom:10px; }
    .topbar button {
      background:#FF6B35; color:#fff; border:none;
      padding:10px 24px; border-radius:8px; font-size:15px;
      cursor:pointer; margin:0 6px; font-weight:600;
    }
    .topbar button.sec { background:#555; }

    /* ─ Hoja A4 ─ */
    .sheet {
      width:210mm;
      margin:20px auto;
      background:#fff;
      padding:8mm;
      box-shadow:0 4px 20px rgba(0,0,0,0.15);
    }

    /* ─ Leyenda de corte ─ */
    .cut-legend {
      font-size:7pt; color:#999; text-align:center;
      margin-bottom:4mm;
      letter-spacing:0.5px;
    }

    /* ─ Grilla 2 × 5 ─ */
    .grid {
      display:grid;
      grid-template-columns:repeat(2, 1fr);
    }

    /* ─ Celda con líneas de corte punteadas ─ */
    .cell {
      border-right:1px dashed #aaa;
      border-bottom:1px dashed #aaa;
      padding:2mm;
    }
    .cell:nth-child(2n)   { border-right:none; }
    .cell:nth-last-child(-n+2) { border-bottom:none; }

    /* ─ Tarjeta ─ */
    .tarjeta {
      width:100%; height:100%;
      min-height:50mm;
      border-radius:3mm;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:4mm 5mm;
      overflow:hidden;
      position:relative;
    }

    /* ─ Columna izquierda ─ */
    .col-left {
      display:flex; flex-direction:column; gap:1.2mm;
      flex:1; min-width:0; padding-right:3mm;
    }
    .badge {
      display:inline-block;
      border-radius:2mm; padding:1mm 3mm;
      width:fit-content;
    }
    .brand  { font-size:14pt; font-weight:900; letter-spacing:-0.4px; line-height:1.1; }
    .tagline{ font-size:7pt;  font-weight:500; }
    .divider{ height:1px; width:100%; margin:0.8mm 0; opacity:0.5; }
    .contact{ font-size:7.5pt; font-weight:600; }
    .url-txt{ font-size:6pt;  word-break:break-all; opacity:0.85; }

    /* ─ Columna derecha ─ */
    .col-right {
      display:flex; flex-direction:column;
      align-items:center; gap:1.5mm; flex-shrink:0;
    }
    .qr-wrap {
      border-radius:2mm; padding:1.5mm; display:inline-block;
    }
    .qr-img  { width:32mm; height:32mm; display:block; }
    .scan-lbl{ font-size:5.5pt; text-transform:uppercase; letter-spacing:0.8px; text-align:center; }

    /* ─ Impresión ─ */
    @media print {
      body { background:transparent; }
      .topbar { display:none; }
      .sheet  { margin:0; box-shadow:none; width:100%; }
      @page   { size:A4 portrait; margin:0; }
    }
  </style>
</head>
<body>

  <div class="topbar">
    <p>&#9988; <strong>10 tarjetas QR</strong> listas para imprimir y recortar &middot; A4 &middot; 2 columnas &times; 5 filas</p>
    <button onclick="window.print()">&#128424; Imprimir / Guardar PDF</button>
    <button class="sec" onclick="window.close()">&#10005; Cerrar</button>
  </div>

  <div class="sheet">
    <div class="cut-legend">&#9988; Líneas punteadas = marcas de corte</div>
    <div class="grid">
      ${grid}
    </div>
  </div>

</body>
</html>`;
}
