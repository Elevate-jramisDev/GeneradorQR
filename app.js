(() => {
  'use strict';

  // ---------- Definición de tipos de contenido ----------
  const escWifi = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  const escVcard = (s) => String(s).replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');

  const TYPES = {
    text: {
      fields: [
        { key: 'text', label: 'Texto o enlace', kind: 'textarea', placeholder: 'https://ejemplo.com' },
      ],
      build: (v) => v.text || '',
    },
    wifi: {
      fields: [
        { key: 'ssid', label: 'Nombre de la red (SSID)', kind: 'text' },
        { key: 'pass', label: 'Contraseña', kind: 'text' },
        {
          key: 'enc', label: 'Seguridad', kind: 'select',
          options: [['WPA', 'WPA/WPA2/WPA3'], ['WEP', 'WEP'], ['nopass', 'Sin contraseña']],
        },
        { key: 'hidden', label: 'Red oculta', kind: 'checkbox' },
      ],
      build: (v) => {
        if (!v.ssid) return '';
        const enc = v.enc || 'WPA';
        let s = `WIFI:T:${enc};S:${escWifi(v.ssid)};`;
        if (enc !== 'nopass') s += `P:${escWifi(v.pass || '')};`;
        if (v.hidden) s += 'H:true;';
        return s + ';';
      },
    },
    email: {
      fields: [
        { key: 'to', label: 'Destinatario', kind: 'email', placeholder: 'nombre@ejemplo.com' },
        { key: 'subject', label: 'Asunto (opcional)', kind: 'text' },
        { key: 'body', label: 'Mensaje (opcional)', kind: 'textarea' },
      ],
      build: (v) => {
        if (!v.to) return '';
        const q = [];
        if (v.subject) q.push('subject=' + encodeURIComponent(v.subject));
        if (v.body) q.push('body=' + encodeURIComponent(v.body));
        return 'mailto:' + v.to.trim() + (q.length ? '?' + q.join('&') : '');
      },
    },
    tel: {
      fields: [
        { key: 'tel', label: 'Teléfono (con prefijo)', kind: 'tel', placeholder: '+34600123456' },
      ],
      build: (v) => (v.tel ? 'tel:' + v.tel.replace(/[^\d+]/g, '') : ''),
    },
    sms: {
      fields: [
        { key: 'tel', label: 'Teléfono (con prefijo)', kind: 'tel', placeholder: '+34600123456' },
        { key: 'msg', label: 'Mensaje (opcional)', kind: 'textarea' },
      ],
      build: (v) => (v.tel ? `SMSTO:${v.tel.replace(/[^\d+]/g, '')}:${v.msg || ''}` : ''),
    },
    whatsapp: {
      fields: [
        { key: 'tel', label: 'Teléfono (con prefijo, sin +)', kind: 'tel', placeholder: '34600123456' },
        { key: 'msg', label: 'Mensaje (opcional)', kind: 'textarea' },
      ],
      build: (v) => {
        const n = (v.tel || '').replace(/\D/g, '');
        if (!n) return '';
        return 'https://wa.me/' + n + (v.msg ? '?text=' + encodeURIComponent(v.msg) : '');
      },
    },
    vcard: {
      fields: [
        { key: 'first', label: 'Nombre', kind: 'text' },
        { key: 'last', label: 'Apellidos', kind: 'text' },
        { key: 'org', label: 'Empresa', kind: 'text' },
        { key: 'tel', label: 'Teléfono', kind: 'tel' },
        { key: 'email', label: 'Email', kind: 'email' },
        { key: 'url', label: 'Web', kind: 'url' },
      ],
      build: (v) => {
        if (!v.first && !v.last && !v.org) return '';
        const lines = [
          'BEGIN:VCARD', 'VERSION:3.0',
          `N:${escVcard(v.last || '')};${escVcard(v.first || '')};;;`,
          `FN:${escVcard(((v.first || '') + ' ' + (v.last || '')).trim() || v.org)}`,
        ];
        if (v.org) lines.push('ORG:' + escVcard(v.org));
        if (v.tel) lines.push('TEL:' + escVcard(v.tel));
        if (v.email) lines.push('EMAIL:' + escVcard(v.email));
        if (v.url) lines.push('URL:' + escVcard(v.url));
        lines.push('END:VCARD');
        return lines.join('\n');
      },
    },
  };

  // ---------- Estado y elementos ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    tabs: $('tabs'), fields: $('fields'), canvas: $('canvas'), empty: $('empty'),
    status: $('status'), fg: $('fg'), bg: $('bg'), size: $('size'), margin: $('margin'),
    ecl: $('ecl'), shape: $('shape'), transparent: $('transparent'),
    warn: $('contrastWarn'), shapeWarn: $('shapeWarn'), dlPng: $('dlPng'), dlSvg: $('dlSvg'), copy: $('copy'),
  };
  const values = {}; // valores por tipo, se conservan al cambiar de pestaña
  let current = 'text';
  let qr = null;      // instancia actual de qrcode
  let timer = null;

  // ---------- UI de campos ----------
  function renderFields() {
    const def = TYPES[current];
    values[current] = values[current] || {};
    els.fields.innerHTML = '';
    def.fields.forEach((f) => {
      const label = document.createElement('label');
      if (f.kind === 'checkbox') label.className = 'check';
      const span = document.createElement('span');
      span.textContent = f.label;
      let input;
      if (f.kind === 'textarea') {
        input = document.createElement('textarea');
      } else if (f.kind === 'select') {
        input = document.createElement('select');
        f.options.forEach(([val, text]) => {
          const o = document.createElement('option');
          o.value = val; o.textContent = text; input.appendChild(o);
        });
      } else {
        input = document.createElement('input');
        input.type = f.kind === 'checkbox' ? 'checkbox' : f.kind;
      }
      input.dataset.key = f.key;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.kind === 'tel') input.inputMode = 'tel';
      input.autocomplete = 'off';
      input.spellcheck = false;
      const saved = values[current][f.key];
      if (f.kind === 'checkbox') input.checked = !!saved;
      else if (saved !== undefined) input.value = saved;
      if (f.kind === 'checkbox') { label.append(input, span); } else { label.append(span, input); }
      els.fields.appendChild(label);
    });
  }

  function readFields() {
    const v = values[current] = values[current] || {};
    els.fields.querySelectorAll('[data-key]').forEach((i) => {
      v[i.dataset.key] = i.type === 'checkbox' ? i.checked : i.value;
    });
    return v;
  }

  // ---------- Generación ----------
  function isFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  function luminance(hex) {
    const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  function opts() {
    const clamp = (x, a, b, d) => { x = parseInt(x, 10); return isNaN(x) ? d : Math.min(b, Math.max(a, x)); };
    return {
      fg: els.fg.value,
      bg: els.bg.value,
      size: clamp(els.size.value, 128, 2048, 512),
      margin: clamp(els.margin.value, 0, 10, 4),
      ecl: els.ecl.value,
      shape: els.shape.value,
      transparent: els.transparent.checked,
    };
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCanvas(o) {
    const n = qr.getModuleCount();
    const total = n + o.margin * 2;
    const cell = Math.max(1, Math.round(o.size / total));
    const px = cell * total;
    const cv = els.canvas;
    cv.width = px; cv.height = px;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, px, px);
    if (!o.transparent) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, px, px); }
    ctx.fillStyle = o.fg;
    ctx.beginPath();
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        const x = (c + o.margin) * cell, y = (r + o.margin) * cell;
        const finder = isFinder(r, c, n);
        if (o.shape === 'round') {
          roundRectPath(ctx, x, y, cell, cell, cell * 0.15);
        } else if (o.shape === 'dot' && !finder) {
          ctx.moveTo(x + cell / 2 + cell * 0.5, y + cell / 2);
          ctx.arc(x + cell / 2, y + cell / 2, cell * 0.5, 0, Math.PI * 2);
        } else {
          ctx.rect(x, y, cell, cell);
        }
      }
    }
    ctx.fill();
    return px;
  }

  function buildSvg(o) {
    const n = qr.getModuleCount();
    const total = n + o.margin * 2;
    let d = '';
    const f = (v) => +v.toFixed(3);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        const x = c + o.margin, y = r + o.margin;
        const finder = isFinder(r, c, n);
        if (o.shape === 'round') {
          const k = 0.15, w = 1 - 2 * k;
          d += `M${f(x + k)} ${y}h${f(w)}a${k} ${k} 0 0 1 ${k} ${k}v${f(w)}a${k} ${k} 0 0 1 -${k} ${k}h-${f(w)}a${k} ${k} 0 0 1 -${k} -${k}v-${f(w)}a${k} ${k} 0 0 1 ${k} -${k}z`;
        } else if (o.shape === 'dot' && !finder) {
          const rad = 0.5;
          d += `M${f(x + 0.5 - rad)} ${f(y + 0.5)}a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 -${rad * 2} 0z`;
        } else {
          d += `M${x} ${y}h1v1h-1z`;
        }
      }
    }
    const bgRect = o.transparent ? '' : `<rect width="${total}" height="${total}" fill="${o.bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${o.size}" height="${o.size}" shape-rendering="${o.shape === 'square' ? 'crispEdges' : 'geometricPrecision'}">${bgRect}<path fill="${o.fg}" d="${d}"/></svg>`;
  }

  function setActions(enabled) {
    els.dlPng.disabled = els.dlSvg.disabled = els.copy.disabled = !enabled;
  }

  function update() {
    const v = readFields();
    const text = TYPES[current].build(v);
    const o = opts();

    // aviso de contraste (solo con fondo opaco)
    let lowContrast = false;
    if (!o.transparent) {
      const a = luminance(o.fg), b = luminance(o.bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      lowContrast = a >= b || ratio < 3;
    }
    els.warn.hidden = !lowContrast;
    els.shapeWarn.hidden = o.shape === 'square';

    if (!text) {
      qr = null;
      els.empty.hidden = false;
      els.canvas.getContext('2d').clearRect(0, 0, els.canvas.width, els.canvas.height);
      els.status.textContent = '';
      setActions(false);
      return;
    }
    try {
      qr = qrcode(0, o.ecl);
      qr.addData(text, 'Byte');
      qr.make();
    } catch (e) {
      qr = null;
      els.empty.hidden = true;
      els.canvas.getContext('2d').clearRect(0, 0, els.canvas.width, els.canvas.height);
      els.status.textContent = 'Demasiado contenido para un QR con esta corrección de errores. Acórtalo o baja el nivel (L).';
      setActions(false);
      return;
    }
    els.empty.hidden = true;
    const px = drawCanvas(o);
    const n = qr.getModuleCount();
    let msg = `${n}×${n} módulos · ${px}×${px} px · ${new Blob([text]).size} bytes`;
    if (current === 'text' && /^(www\.|[a-z0-9-]+\.[a-z]{2,}(\/|$))/i.test(text.trim()) && !/^[a-z][a-z0-9+.-]*:/i.test(text.trim())) {
      msg += ' · Aviso: sin https:// muchos móviles lo tratarán como texto, no como enlace.';
    }
    els.status.textContent = msg;
    setActions(true);
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(update, 100); }

  // ---------- Descargas ----------
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  els.dlPng.addEventListener('click', () => {
    if (!qr) return;
    els.canvas.toBlob((b) => b && download(b, `qr-${current}.png`), 'image/png');
  });
  els.dlSvg.addEventListener('click', () => {
    if (!qr) return;
    download(new Blob([buildSvg(opts())], { type: 'image/svg+xml' }), `qr-${current}.svg`);
  });
  els.copy.addEventListener('click', () => {
    if (!qr) return;
    els.canvas.toBlob(async (b) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
        els.status.textContent = 'Imagen copiada al portapapeles.';
      } catch (e) {
        els.status.textContent = 'Tu navegador no permite copiar imágenes aquí. Usa Descargar PNG.';
      }
    }, 'image/png');
  });

  // ---------- Eventos ----------
  els.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-type]');
    if (!b || b.dataset.type === current) return;
    readFields();
    current = b.dataset.type;
    els.tabs.querySelectorAll('button').forEach((x) => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', on);
    });
    renderFields();
    update();
  });
  els.fields.addEventListener('input', schedule);
  els.fields.addEventListener('change', schedule);
  [els.fg, els.bg, els.size, els.margin, els.ecl, els.shape, els.transparent]
    .forEach((el) => el.addEventListener('input', schedule));

  renderFields();
  update();
})();
