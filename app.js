/* DSE – Digital Signage Image Arranger. Pure client-side; no dependencies. */
(() => {
  'use strict';

  // ---------- Layout engine ----------
  // Each pattern returns an array of n rects in unit space {x,y,w,h} (0..1).
  // `hero` is 0..1 fraction used by hero-style patterns. `aspect` = W/H of canvas.

  const evenRow = (n, y, h) => Array.from({ length: n }, (_, i) => ({ x: i / n, y, w: 1 / n, h }));
  const evenCol = (n, x, w) => Array.from({ length: n }, (_, i) => ({ x, y: i / n, w, h: 1 / n }));

  function gridRects(n, aspect, colsOverride) {
    if (n === 0) return [];
    // choose cols so that cells are as close to square as possible on this canvas aspect
    let cols = colsOverride;
    if (!cols) {
      let best = 1, bestScore = Infinity;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const cellAspect = (aspect / c) / (1 / r);   // cell w/h
        const score = Math.abs(Math.log(cellAspect));
        if (score < bestScore) { bestScore = score; best = c; }
      }
      cols = best;
    }
    const rows = Math.ceil(n / cols);
    const rects = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const inRow = Math.min(cols, n - i);          // last row stretches to fill width
      for (let c = 0; c < inRow; c++, i++) rects.push({ x: c / inRow, y: r / rows, w: 1 / inRow, h: 1 / rows });
    }
    return rects;
  }

  const PATTERNS = [
    { id: 'grid', name: '自動グリッド', min: 1, fn: (n, a) => gridRects(n, a) },
    { id: 'grid2', name: '2列', min: 2, fn: (n) => gridRects(n, 1, 2) },
    { id: 'grid3', name: '3列', min: 3, fn: (n) => gridRects(n, 1, 3) },
    { id: 'rows', name: '縦に並べる', min: 1, fn: (n) => evenCol(n, 0, 1) },
    { id: 'cols', name: '横に並べる', min: 1, fn: (n) => evenRow(n, 0, 1) },
    { id: 'heroTop', name: 'メイン上', min: 2, hero: true,
      fn: (n, a, h) => [{ x: 0, y: 0, w: 1, h }, ...evenRow(n - 1, h, 1 - h)] },
    { id: 'heroBottom', name: 'メイン下', min: 2, hero: true,
      fn: (n, a, h) => [{ x: 0, y: 1 - h, w: 1, h }, ...evenRow(n - 1, 0, 1 - h)] },
    { id: 'heroLeft', name: 'メイン左', min: 2, hero: true,
      fn: (n, a, h) => [{ x: 0, y: 0, w: h, h: 1 }, ...evenCol(n - 1, h, 1 - h)] },
    { id: 'heroRight', name: 'メイン右', min: 2, hero: true,
      fn: (n, a, h) => [{ x: 1 - h, y: 0, w: h, h: 1 }, ...evenCol(n - 1, 0, 1 - h)] },
    { id: 'heroTopGrid', name: 'メイン＋グリッド', min: 3, hero: true,
      fn: (n, a, h) => [{ x: 0, y: 0, w: 1, h },
        ...gridRects(n - 1, a / ((1 - h))).map(r => ({ x: r.x, y: h + r.y * (1 - h), w: r.w, h: r.h * (1 - h) }))] },
    { id: 'mosaic', name: 'モザイクA', min: 2, fn: (n) => {
        // rows alternate 1, 2, 1, 2 ... items
        const rows = []; let i = 0, k = 0;
        while (i < n) { const c = Math.min(k % 2 === 0 ? 1 : 2, n - i); rows.push(c); i += c; k++; }
        const rects = []; const rh = 1 / rows.length;
        rows.forEach((c, r) => rects.push(...evenRow(c, r * rh, rh)));
        return rects; } },
    { id: 'mosaic2', name: 'モザイクB', min: 2, fn: (n) => {
        const rows = []; let i = 0, k = 0;
        while (i < n) { const c = Math.min(k % 2 === 0 ? 2 : 1, n - i); rows.push(c); i += c; k++; }
        const rects = []; const rh = 1 / rows.length;
        rows.forEach((c, r) => rects.push(...evenRow(c, r * rh, rh)));
        return rects; } },
    { id: 'brick', name: 'レンガ', min: 3, fn: (n) => {
        // rows of 2, odd rows offset (3 cells with half cells at the edges -> we use 2 + shifted)
        const rows = Math.ceil(n / 2); const rects = []; let i = 0;
        for (let r = 0; r < rows && i < n; r++) {
          const c = Math.min(2, n - i);
          const rowRects = evenRow(c, r / rows, 1 / rows);
          if (r % 2 === 1 && c === 2) { rowRects[0].w = 0.62; rowRects[1].x = 0.62; rowRects[1].w = 0.38; }
          else if (c === 2) { rowRects[0].w = 0.38; rowRects[1].x = 0.38; rowRects[1].w = 0.62; }
          rects.push(...rowRects); i += c;
        }
        return rects; } },
    { id: 'masonry', name: 'メイソンリー', min: 2, fn: (n) => {
        // two columns, alternate assignment, each column divided evenly
        const left = [], right = [];
        for (let i = 0; i < n; i++) (i % 2 === 0 ? left : right).push(i);
        const out = new Array(n);
        const place = (list, x) => list.forEach((idx, j) => out[idx] = { x, y: j / list.length, w: 0.5, h: 1 / list.length });
        place(left, 0); if (right.length) place(right, 0.5); else out[0].w = 1;
        return out; } },
    { id: 'lShape', name: 'L字', min: 3, hero: true, fn: (n, a, h) => {
        // hero top-left, one column right, one row bottom
        const rest = n - 1; const right = Math.ceil(rest / 2); const bottom = rest - right;
        const rects = [{ x: 0, y: 0, w: h, h: bottom ? h : 1 }];
        rects.push(...evenCol(right, h, 1 - h).map(r => ({ ...r, y: r.y * (bottom ? h : 1), h: r.h * (bottom ? h : 1) })));
        if (bottom) rects.push(...evenRow(bottom, h, 1 - h));
        return rects; } },
    { id: 'pinwheel', name: '風車', min: 4, hero: true, fn: (n, a, h) => {
        const s = h, t = 1 - h;
        const base = [
          { x: 0, y: 0, w: s, h: t }, { x: s, y: 0, w: t, h: s },
          { x: t, y: s, w: s, h: t }, { x: 0, y: t, w: t, h: s },
        ];
        if (n === 4) return base;
        // extra images go into the center area, stacked
        const center = { x: t, y: t, w: s - t, h: s - t };
        const extra = evenCol(n - 4, center.x, center.w).map(r => ({ ...r, y: center.y + r.y * center.h, h: r.h * center.h }));
        return [...base, ...extra]; } },
    { id: 'diag', name: '階段', min: 2, fn: (n) => {
        // each image is a wide row that steps across the canvas; remaining strip stays background
        const rects = []; const rh = 1 / n, w = 0.7;
        for (let i = 0; i < n; i++) rects.push({ x: (i / (n - 1)) * (1 - w), y: i * rh, w, h: rh });
        return rects; } },
  ];

  const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map(p => [p.id, p]));

  function computeRects(patternId, n, aspect, hero, flip) {
    const p = PATTERN_BY_ID[patternId] || PATTERNS[0];
    let rects = p.fn(n, aspect, hero);
    if (flip) rects = rects.map(r => ({ ...r, x: 1 - r.x - r.w }));
    return rects;
  }

  // ---------- State ----------
  const state = {
    images: [],          // {id, name, img (HTMLImageElement), url}
    pattern: 'grid',
    hero: 0.6,
    flip: false,
    gap: 12, margin: 0, radius: 0,
    fit: 'cover',
    bg: '#000000',
    W: 1080, H: 1920,
  };
  let uid = 0;

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const els = {
    drop: $('dropzone'), file: $('fileInput'), browse: $('btnBrowse'), list: $('imageList'),
    shuffle: $('btnShuffle'), clear: $('btnClear'), preset: $('sizePreset'), w: $('canvasW'), h: $('canvasH'),
    patterns: $('patternGrid'), heroRow: $('heroRatioRow'), hero: $('heroRatio'), heroVal: $('heroRatioVal'),
    flip: $('chkFlip'), gap: $('gap'), gapVal: $('gapVal'), margin: $('margin'), marginVal: $('marginVal'),
    radius: $('radius'), radiusVal: $('radiusVal'), fit: $('fitMode'), bg: $('bgColor'),
    png: $('btnExportPng'), jpg: $('btnExportJpg'), empty: $('emptyMsg'), info: $('stageInfo'),
  };

  // ---------- Image loading ----------
  function addFiles(files) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    const loads = list.map(f => new Promise(res => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => res({ id: ++uid, name: f.name, img, url });
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    }));
    Promise.all(loads).then(items => {
      items.filter(Boolean).forEach(it => state.images.push(it));
      renderList(); renderPatterns(); draw();
    });
  }

  function removeImage(id) {
    const i = state.images.findIndex(x => x.id === id);
    if (i >= 0) { URL.revokeObjectURL(state.images[i].url); state.images.splice(i, 1); }
    renderList(); renderPatterns(); draw();
  }

  // ---------- Thumbnail list with drag reorder ----------
  let dragFrom = null;
  function renderList() {
    els.list.innerHTML = '';
    state.images.forEach((it, i) => {
      const li = document.createElement('li');
      li.draggable = true; li.dataset.id = it.id; li.title = it.name;
      li.innerHTML = `<img src="${it.url}" alt=""><span class="idx">${i + 1}</span><button class="del" title="削除">×</button>`;
      li.querySelector('.del').addEventListener('click', e => { e.stopPropagation(); removeImage(it.id); });
      li.addEventListener('dragstart', () => { dragFrom = i; li.classList.add('dragging'); });
      li.addEventListener('dragend', () => { dragFrom = null; li.classList.remove('dragging'); });
      li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('over'); });
      li.addEventListener('dragleave', () => li.classList.remove('over'));
      li.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation(); li.classList.remove('over');
        if (dragFrom === null || dragFrom === i) return;
        const [moved] = state.images.splice(dragFrom, 1);
        state.images.splice(i, 0, moved);
        renderList(); draw();
      });
      // click-to-swap fallback for touch: click one, then another
      li.addEventListener('click', () => {
        if (swapSel === null) { swapSel = i; li.classList.add('over'); }
        else { const a = swapSel; swapSel = null;
          if (a !== i) { [state.images[a], state.images[i]] = [state.images[i], state.images[a]]; }
          renderList(); draw(); }
      });
      els.list.appendChild(li);
    });
  }
  let swapSel = null;

  // ---------- Pattern picker ----------
  function patternSvg(p, n, aspect) {
    const w = 60, h = 60 / aspect;
    const rects = computeRects(p.id, n, aspect, state.hero, state.flip);
    const g = 1.5;
    const body = rects.map((r, i) =>
      `<rect x="${(r.x * w + g).toFixed(1)}" y="${(r.y * h + g).toFixed(1)}" width="${Math.max(0, r.w * w - 2 * g).toFixed(1)}" height="${Math.max(0, r.h * h - 2 * g).toFixed(1)}" rx="1.5" fill="${i === 0 ? '#4f8cff' : '#5f6675'}"/>`).join('');
    return `<svg viewBox="0 0 ${w} ${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  function renderPatterns() {
    const n = Math.max(state.images.length, 1);
    const aspect = state.W / state.H;
    els.patterns.innerHTML = '';
    const avail = PATTERNS.filter(p => n >= p.min);
    if (!avail.some(p => p.id === state.pattern)) state.pattern = 'grid';
    avail.forEach(p => {
      const d = document.createElement('div');
      d.className = 'pattern' + (p.id === state.pattern ? ' active' : '');
      d.innerHTML = patternSvg(p, n, aspect) + `<div class="name">${p.name}</div>`;
      d.title = p.name;
      d.addEventListener('click', () => { state.pattern = p.id; renderPatterns(); draw(); });
      els.patterns.appendChild(d);
    });
    els.heroRow.style.display = PATTERN_BY_ID[state.pattern].hero ? '' : 'none';
  }

  // ---------- Drawing ----------
  function roundRectPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawImageFit(c, img, x, y, w, h, mode) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = mode === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function render(c, W, H) {
    c.fillStyle = state.bg; c.fillRect(0, 0, W, H);
    const n = state.images.length;
    if (!n) return;
    const m = state.margin, g = state.gap;
    const innerW = W - 2 * m, innerH = H - 2 * m;
    const rects = computeRects(state.pattern, n, W / H, state.hero, state.flip);
    rects.forEach((r, i) => {
      // gap handling: each cell shrinks by half the gap on internal edges only
      const x0 = m + r.x * innerW, y0 = m + r.y * innerH, x1 = x0 + r.w * innerW, y1 = y0 + r.h * innerH;
      const eps = 0.5;
      const L = x0 + (x0 - m > eps ? g / 2 : 0), T = y0 + (y0 - m > eps ? g / 2 : 0);
      const R = x1 - (m + innerW - x1 > eps ? g / 2 : 0), B = y1 - (m + innerH - y1 > eps ? g / 2 : 0);
      const w = R - L, h = B - T;
      if (w <= 0 || h <= 0) return;
      c.save();
      roundRectPath(c, L, T, w, h, state.radius);
      c.clip();
      drawImageFit(c, state.images[i].img, L, T, w, h, state.fit);
      c.restore();
    });
  }

  let raf = null;
  function draw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (canvas.width !== state.W || canvas.height !== state.H) { canvas.width = state.W; canvas.height = state.H; }
      render(ctx, state.W, state.H);
      const has = state.images.length > 0;
      els.empty.style.display = has ? 'none' : '';
      els.png.disabled = els.jpg.disabled = !has;
      els.info.textContent = `${state.W} × ${state.H} px · ${state.images.length}枚 · ${PATTERN_BY_ID[state.pattern].name}`;
    });
  }

  // ---------- Export ----------
  function exportAs(type) {
    const off = document.createElement('canvas');
    off.width = state.W; off.height = state.H;
    render(off.getContext('2d'), state.W, state.H);
    const ext = type === 'image/jpeg' ? 'jpg' : 'png';
    off.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dse-${state.pattern}-${state.W}x${state.H}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, type, 0.92);
  }

  // ---------- Events ----------
  els.browse.addEventListener('click', e => { e.stopPropagation(); els.file.click(); });
  els.drop.addEventListener('click', () => els.file.click());
  els.file.addEventListener('change', () => { addFiles(els.file.files); els.file.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove('over'); }));
  document.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', e => {
    const files = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file').map(i => i.getAsFile());
    if (files.length) addFiles(files);
  });

  els.shuffle.addEventListener('click', () => {
    for (let i = state.images.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [state.images[i], state.images[j]] = [state.images[j], state.images[i]]; }
    renderList(); draw();
  });
  els.clear.addEventListener('click', () => { state.images.forEach(i => URL.revokeObjectURL(i.url)); state.images = []; renderList(); renderPatterns(); draw(); });

  function applySize() {
    state.W = Math.max(16, Math.min(8192, +els.w.value || 1080));
    state.H = Math.max(16, Math.min(8192, +els.h.value || 1920));
    renderPatterns(); draw();
  }
  els.preset.addEventListener('change', () => {
    if (els.preset.value === 'custom') return;
    const [w, h] = els.preset.value.split('x').map(Number);
    els.w.value = w; els.h.value = h; applySize();
  });
  [els.w, els.h].forEach(el => el.addEventListener('input', () => { els.preset.value = 'custom'; applySize(); }));

  els.hero.addEventListener('input', () => { state.hero = els.hero.value / 100; els.heroVal.textContent = els.hero.value + '%'; renderPatterns(); draw(); });
  els.flip.addEventListener('change', () => { state.flip = els.flip.checked; renderPatterns(); draw(); });
  const bindRange = (el, valEl, key) => el.addEventListener('input', () => { state[key] = +el.value; valEl.textContent = el.value + ' px'; draw(); });
  bindRange(els.gap, els.gapVal, 'gap'); bindRange(els.margin, els.marginVal, 'margin'); bindRange(els.radius, els.radiusVal, 'radius');
  els.fit.addEventListener('change', () => { state.fit = els.fit.value; draw(); });
  els.bg.addEventListener('input', () => { state.bg = els.bg.value; draw(); });
  els.png.addEventListener('click', () => exportAs('image/png'));
  els.jpg.addEventListener('click', () => exportAs('image/jpeg'));

  // expose for testing
  window.DSE = { state, PATTERNS, computeRects, addFiles, draw, render };

  renderPatterns(); draw();
})();
