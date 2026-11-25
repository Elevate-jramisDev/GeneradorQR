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
    dynamicPanel: $('dynamicPanel'), dynamicUrl: $('dynamicUrl'), adminKey: $('adminKey'), dynamicLabel: $('dynamicLabel'), dynamicCode: $('dynamicCode'),
    saveDynamic: $('saveDynamic'), listDynamic: $('listDynamic'), dynamicStatus: $('dynamicStatus'), dynamicList: $('dynamicList'),
    scanQr: $('scanQr'), stopScan: $('stopScan'), scanVideo: $('scanVideo'), scanImage: $('scanImage'), scanStatus: $('scanStatus'),
  };
  const values = {}; // valores por tipo, se conservan al cambiar de pestaña
  let current = 'text';
  let qr = null;      // instancia actual de qrcode
  let timer = null;
  let dynamicId = null;
  let scanStream = null;
  let scanFrame = null;
  let lastScanFrameAt = 0;

  function dynamicUrl(id) { return `${location.origin}/r/${encodeURIComponent(id)}`; }

  function adminHeaders() {
    const token = els.adminKey.value.trim();
    if (!token) throw new Error('Introduce la clave de administración.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

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
    const text = dynamicId ? dynamicUrl(dynamicId) : TYPES[current].build(v);
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

  function openDynamicEntry(entry, id = '') {
    const qrId = entry?.id || id;
    current = 'text'; dynamicId = entry?.id || null;
    els.tabs.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.type === 'text';
      b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
    });
    values.text = { ...(values.text || {}), text: entry?.url || '' };
    renderFields();
    els.fields.querySelector('[data-key="text"]').value = entry?.url || '';
    els.dynamicUrl.value = entry?.url || '';
    els.dynamicPanel.hidden = false;
    els.dynamicLabel.value = entry?.label || '';
    els.dynamicCode.value = qrId;
    els.saveDynamic.textContent = entry ? 'Guardar cambios' : 'Activar QR';
    update();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    els.dynamicStatus.textContent = entry
      ? `QR ${qrId} cargado. Cambia el destino y guarda.`
      : `QR ${qrId} encontrado; aún no está activado. Introduce el destino y pulsa «Activar QR».`;
  }

  async function loadDynamicList(selectId = '') {
    try {
      const response = await fetch('/api/dynamic', { headers: adminHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los QR.');
      els.dynamicList.replaceChildren();
      data.forEach((entry) => {
        const row = document.createElement('div'); row.className = 'dynamicItem';
        const info = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = entry.label || entry.id;
        const url = document.createElement('span'); url.textContent = entry.url;
        info.append(title, url);
        const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Editar';
        edit.addEventListener('click', () => openDynamicEntry(entry));
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Eliminar';
        remove.addEventListener('click', async () => {
          if (!window.confirm(`¿Eliminar el QR «${entry.label || entry.id}»?`)) return;
          const result = await fetch(`/api/dynamic?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE', headers: adminHeaders() });
          if (!result.ok) { els.dynamicStatus.textContent = 'No se pudo eliminar.'; return; }
          if (dynamicId === entry.id) { dynamicId = null; update(); }
          loadDynamicList();
        });
        row.append(info, edit, remove); els.dynamicList.append(row);
      });
      if (selectId) {
        const entry = data.find((item) => item.id === selectId);
        openDynamicEntry(entry || null, selectId);
      } else {
        els.dynamicStatus.textContent = data.length ? `${data.length} QR dinámico(s).` : 'Todavía no hay QR dinámicos.';
      }
    } catch (error) { els.dynamicStatus.textContent = error.message; }
  }

  function stopQrScan() {
    if (scanFrame) cancelAnimationFrame(scanFrame);
    scanFrame = null;
    if (scanStream) scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
    els.scanVideo.pause(); els.scanVideo.srcObject = null; els.scanVideo.hidden = true;
    els.stopScan.hidden = true; els.scanQr.disabled = false;
  }

  function useScannedValue(value) {
    let id = '';
    try {
      const parsed = new URL(value);
      const match = parsed.pathname.match(/\/r\/([A-Za-z0-9_-]{6,32})\/?$/);
      if (match) id = match[1];
    } catch { /* El QR debe contener una URL válida del redireccionador. */ }
    if (!id) {
      els.scanStatus.textContent = 'Ese QR no pertenece a este generador. Escanea uno de tus QR dinámicos.';
      return;
    }
    stopQrScan();
    els.scanStatus.textContent = 'QR leído. Cargando sus datos…';
    loadDynamicList(id);
  }

  function scanPixels(canvas) {
    if (typeof window.jsQR !== 'function') {
      els.scanStatus.textContent = 'No se pudo cargar el lector QR. Comprueba la conexión e inténtalo de nuevo.';
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = window.jsQR(pixels.data, pixels.width, pixels.height);
    if (result) useScannedValue(result.data);
    return !!result;
  }

  els.scanQr.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      els.scanStatus.textContent = 'Este navegador no permite usar la cámara. Prueba «Escanear desde una foto».';
      return;
    }
    try {
      els.scanQr.disabled = true;
      els.scanStatus.textContent = 'Solicitando acceso a la cámara…';
      scanStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      els.scanVideo.srcObject = scanStream; els.scanVideo.hidden = false;
      await els.scanVideo.play();
      els.stopScan.hidden = false; els.scanStatus.textContent = 'Apunta la cámara a un QR dinámico.';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const scan = (timestamp) => {
        if (!scanStream) return;
        scanFrame = requestAnimationFrame(scan);
        if (timestamp - lastScanFrameAt < 180 || !els.scanVideo.videoWidth) return;
        lastScanFrameAt = timestamp;
        const scale = Math.min(1, 720 / els.scanVideo.videoWidth);
        canvas.width = Math.round(els.scanVideo.videoWidth * scale);
        canvas.height = Math.round(els.scanVideo.videoHeight * scale);
        ctx.drawImage(els.scanVideo, 0, 0, canvas.width, canvas.height);
        scanPixels(canvas);
      };
      scanFrame = requestAnimationFrame(scan);
    } catch (error) {
      stopQrScan();
      els.scanStatus.textContent = error.name === 'NotAllowedError'
        ? 'Permite el acceso a la cámara para escanear el QR.'
        : 'No se pudo iniciar la cámara. Prueba escanear desde una foto.';
    }
  });
  els.stopScan.addEventListener('click', () => { stopQrScan(); els.scanStatus.textContent = 'Cámara detenida.'; });
  els.scanImage.addEventListener('change', () => {
    const file = els.scanImage.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      if (!scanPixels(canvas)) els.scanStatus.textContent = 'No se encontró un QR legible en la foto.';
      els.scanImage.value = '';
    };
    img.onerror = () => { URL.revokeObjectURL(url); els.scanStatus.textContent = 'No se pudo abrir la imagen.'; };
    img.src = url;
  });

  els.saveDynamic.addEventListener('click', async () => {
    const target = els.dynamicUrl.value.trim();
    values.text = { ...(values.text || {}), text: target };
    const textField = els.fields.querySelector('[data-key="text"]');
    if (textField) textField.value = target;
    update();
    try {
      const response = await fetch('/api/dynamic', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ id: dynamicId || els.dynamicCode.value.trim() || undefined, url: target.trim(), label: els.dynamicLabel.value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el QR.');
      dynamicId = data.id; els.dynamicCode.value = data.id; els.saveDynamic.textContent = 'Guardar cambios';
      els.dynamicStatus.textContent = `QR listo. Su dirección permanente es ${dynamicUrl(data.id)}`;
      update(); loadDynamicList();
    } catch (error) { els.dynamicStatus.textContent = error.message; }
  });
  els.listDynamic.addEventListener('click', loadDynamicList);
  els.dynamicUrl.addEventListener('input', () => {
    values.text = { ...(values.text || {}), text: els.dynamicUrl.value };
    const textField = els.fields.querySelector('[data-key="text"]');
    if (textField) textField.value = els.dynamicUrl.value;
    update();
  });

  // ---------- Eventos ----------
  els.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-type]');
    if (!b || b.dataset.type === current) return;
    readFields();
    current = b.dataset.type;
    dynamicId = null; els.saveDynamic.textContent = 'Crear QR dinámico';
    els.dynamicPanel.hidden = current !== 'text';
    els.tabs.querySelectorAll('button').forEach((x) => {
      const on = x === b;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', on);
    });
    renderFields();
    update();
  });
  els.fields.addEventListener('input', (e) => {
    if (e.target.matches('[data-key="text"]') && current === 'text') els.dynamicUrl.value = e.target.value;
    schedule();
  });
  els.fields.addEventListener('change', (e) => {
    if (e.target.matches('[data-key="text"]') && current === 'text') els.dynamicUrl.value = e.target.value;
    schedule();
  });
  [els.fg, els.bg, els.size, els.margin, els.ecl, els.shape, els.transparent]
    .forEach((el) => el.addEventListener('input', schedule));

  renderFields();
  els.dynamicPanel.hidden = current !== 'text';
  update();
})();
