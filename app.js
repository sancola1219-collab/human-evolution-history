/* =============================================================================
 * app.js — 流程／互動層
 * -----------------------------------------------------------------------------
 * 兩種模式：
 *   遠看（overview）：整條 700 萬年時間軸，滑鼠拖曳/滾輪瀏覽，點某階段 → 近看。
 *   近看（scene）   ：全螢幕寫實場景 + 教學面板 + 縮放（看解剖細節）+ 左右切換。
 *
 * 依賴：data.js（EVOLUTION_STAGES / STAGE_BY_ID / TIME_MIN / TIME_MAX）
 *       scenes.js（SceneRenderer / drawFigure）
 * ========================================================================== */

(function () {
  'use strict';

  const SAVEKEY = 'humanEvolution.v1'; // 存檔結構若改版，這個 key 要 +1（HANDOFF §存檔）

  // ---- DOM ----
  const canvas = document.getElementById('scene');
  const tl = document.getElementById('timeline');
  const tlCtx = tl.getContext('2d');
  const infoPanel = document.getElementById('info');
  const zoomSlider = document.getElementById('zoom');
  const btnBack = document.getElementById('back');
  const btnPrev = document.getElementById('prev');
  const btnNext = document.getElementById('next');
  const modeOverview = document.getElementById('overview');
  const modeScene = document.getElementById('sceneMode');
  const progressBar = document.getElementById('progressBar');

  // ---- 狀態 ----
  let mode = 'overview';        // 'overview' | 'scene'
  let current = 0;             // 目前階段 index
  let zoom = 1;                // 近看縮放
  let t0 = 0;                  // 動畫起始時間（毫秒）
  const renderer = new SceneRenderer(canvas);
  const visited = loadVisited();

  // 遠看的視窗（用「距今年數」為單位，log 尺度）
  let view = { center: 3.5, span: 7.2 }; // 對數座標，見 toLog/fromLog

  // ---------- 存檔（記錄看過哪些階段） ----------
  function loadVisited() {
    try {
      const raw = localStorage.getItem(SAVEKEY);
      if (raw) return new Set(JSON.parse(raw).visited || []);
    } catch (e) { /* 忽略毀損存檔 */ }
    return new Set();
  }
  function saveVisited() {
    try { localStorage.setItem(SAVEKEY, JSON.stringify({ visited: [...visited] })); } catch (e) {}
  }

  // ---------- 對數時間座標（讓 700 萬年與 1 萬年都看得到） ----------
  // 用 log10(yearsAgo)。present 用一個小值避免 log(0)。
  function toLog(yearsAgo) { return Math.log10(Math.max(yearsAgo, 1000)); }
  const LOG_MIN = toLog(8000);      // 稍早於文明（右端＝近代）
  const LOG_MAX = toLog(TIME_MAX);  // 700 萬年（左端＝遠古）

  // ---------- 尺寸 ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, tl]) {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      // 存 CSS 尺寸供繪圖用
      c._cssW = r.width; c._cssH = r.height;
    }
  }
  window.addEventListener('resize', resize);

  // ---------- 遠看：時間軸 ----------
  function drawTimeline(t) {
    const w = tl._cssW, h = tl._cssH;
    tlCtx.clearRect(0, 0, tl.width, tl.height);
    // 背景漸層（左古右今）
    const bg = tlCtx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#2a1c14'); bg.addColorStop(0.5, '#243040'); bg.addColorStop(1, '#1a2a3a');
    tlCtx.fillStyle = bg; tlCtx.fillRect(0, 0, w, h);

    // 視窗換算：log 值 -> x 像素
    const vMin = view.center - view.span / 2, vMax = view.center + view.span / 2;
    const xOf = (logv) => (logv - vMin) / (vMax - vMin) * w;

    // 時間刻度（每個 10 的次方）
    tlCtx.fillStyle = 'rgba(255,255,255,0.35)';
    tlCtx.strokeStyle = 'rgba(255,255,255,0.12)';
    tlCtx.font = '12px sans-serif'; tlCtx.textAlign = 'center';
    for (let e = 4; e <= 7; e++) {
      const x = xOf(e);
      if (x < -40 || x > w + 40) continue;
      tlCtx.beginPath(); tlCtx.moveTo(x, h * 0.55); tlCtx.lineTo(x, h); tlCtx.stroke();
      const label = e >= 6 ? (Math.pow(10, e - 6) + ' 百萬年前') : (Math.pow(10, e) / 10000 + ' 萬年前');
      tlCtx.fillText(label, x, h * 0.5);
    }

    // 中央軸線
    const axisY = h * 0.62;
    tlCtx.strokeStyle = 'rgba(255,220,160,0.5)'; tlCtx.lineWidth = 2;
    tlCtx.beginPath(); tlCtx.moveTo(0, axisY); tlCtx.lineTo(w, axisY); tlCtx.stroke();

    // 每個階段的節點 + 縮圖
    EVOLUTION_STAGES.forEach((s, i) => {
      const x = xOf(toLog(s.yearsAgo));
      if (x < -80 || x > w + 80) return;
      const isVisited = visited.has(s.id);
      // 連到軸的桿
      tlCtx.strokeStyle = 'rgba(255,255,255,0.25)'; tlCtx.lineWidth = 1;
      tlCtx.beginPath(); tlCtx.moveTo(x, axisY); tlCtx.lineTo(x, axisY - 46); tlCtx.stroke();
      // 縮圖圓底
      tlCtx.fillStyle = isVisited ? 'rgba(255,210,140,0.18)' : 'rgba(255,255,255,0.06)';
      tlCtx.beginPath(); tlCtx.arc(x, axisY - 64, 26, 0, Math.PI * 2); tlCtx.fill();
      // 迷你人物（展示姿勢/腦殼演化）
      tlCtx.save(); tlCtx.translate(x, axisY - 50); tlCtx.scale(0.32, 0.32);
      drawFigure(tlCtx, 0, 0, 1, s.figure, t + i);
      tlCtx.restore();
      // 節點
      tlCtx.fillStyle = i === current ? '#ffd98a' : (isVisited ? '#ffb95a' : '#8aa0b0');
      tlCtx.beginPath(); tlCtx.arc(x, axisY, i === current ? 7 : 5, 0, Math.PI * 2); tlCtx.fill();
      // 名稱
      tlCtx.fillStyle = 'rgba(255,255,255,0.85)'; tlCtx.font = '13px sans-serif';
      tlCtx.fillText(s.name, x, axisY + 22);
      tlCtx.fillStyle = 'rgba(255,255,255,0.45)'; tlCtx.font = '11px sans-serif';
      tlCtx.fillText(s.timeLabel, x, axisY + 38);
    });

    // 標題提示
    tlCtx.fillStyle = 'rgba(255,255,255,0.5)'; tlCtx.font = '12px sans-serif'; tlCtx.textAlign = 'left';
    tlCtx.fillText('← 拖曳平移 · 滾輪縮放 · 點任一階段進入近看', 16, 24);
  }

  // 時間軸互動
  function tlLogAtX(px) {
    const w = tl._cssW;
    const vMin = view.center - view.span / 2, vMax = view.center + view.span / 2;
    return vMin + (px / w) * (vMax - vMin);
  }
  function stageNearX(px, py) {
    const w = tl._cssW, h = tl._cssH, axisY = h * 0.62;
    const vMin = view.center - view.span / 2, vMax = view.center + view.span / 2;
    let best = -1, bd = 40;
    EVOLUTION_STAGES.forEach((s, i) => {
      const x = (toLog(s.yearsAgo) - vMin) / (vMax - vMin) * w;
      const d = Math.abs(px - x);
      if (d < bd && py < axisY + 30) { bd = d; best = i; }
    });
    return best;
  }

  let dragging = false, lastX = 0, moved = 0;
  tl.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; moved = 0; tl.setPointerCapture(e.pointerId); });
  tl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    view.center -= dx / tl._cssW * view.span;
    clampView();
  });
  tl.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 6) { // 視為點擊
      const r = tl.getBoundingClientRect();
      const i = stageNearX(e.clientX - r.left, e.clientY - r.top);
      if (i >= 0) enterScene(i);
    }
  });
  tl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = tl.getBoundingClientRect();
    const anchor = tlLogAtX(e.clientX - r.left);
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    const newSpan = Math.min(8, Math.max(1.2, view.span * factor));
    // 以游標為錨縮放
    view.center = anchor + (view.center - anchor) * (newSpan / view.span);
    view.span = newSpan; clampView();
  }, { passive: false });
  function clampView() {
    view.span = Math.min(8, Math.max(1.2, view.span));
    const half = view.span / 2;
    view.center = Math.min(LOG_MAX + 0.4 - half + view.span, Math.max(LOG_MIN - 0.4 + half - view.span + view.span, view.center));
    // 簡單夾住中心
    view.center = Math.min(LOG_MAX + 0.6, Math.max(LOG_MIN - 0.6, view.center));
  }

  // ---------- 近看：進入/離開 ----------
  function enterScene(i) {
    current = i; mode = 'scene'; zoom = 1; zoomSlider.value = 1;
    visited.add(EVOLUTION_STAGES[i].id); saveVisited();
    modeOverview.classList.remove('active');
    modeScene.classList.add('active');
    resize();
    updateInfo();
  }
  function exitScene() {
    mode = 'overview';
    modeScene.classList.remove('active');
    modeOverview.classList.add('active');
    resize();
  }
  function go(delta) {
    let n = current + delta;
    if (n < 0) n = 0; if (n >= EVOLUTION_STAGES.length) n = EVOLUTION_STAGES.length - 1;
    enterScene(n);
  }

  // ---------- 教學面板 ----------
  function updateInfo() {
    const s = EVOLUTION_STAGES[current];
    const bar = Math.round((current + 1) / EVOLUTION_STAGES.length * 100);
    progressBar.style.width = bar + '%';
    infoPanel.innerHTML = `
      <div class="info-head">
        <div class="info-idx">${current + 1} / ${EVOLUTION_STAGES.length}</div>
        <h2>${s.name}</h2>
        <div class="latin">${s.latin}</div>
        <div class="time">${s.timeLabel} · ${s.epoch}</div>
      </div>
      <div class="milestone">🌟 ${s.milestone}</div>
      <div class="stats">
        <div class="stat"><span>🧠 腦容量</span><b>${s.brainCc} cc</b></div>
        <div class="stat"><span>📏 身高</span><b>約 ${s.heightCm} cm</b></div>
        <div class="stat"><span>🌍 分布</span><b>${s.region}</b></div>
        <div class="stat"><span>🍖 食性</span><b>${s.diet}</b></div>
      </div>
      <div class="block"><h3>棲地／氣候</h3><p>${s.habitat}</p></div>
      <div class="block"><h3>關鍵特徵</h3><ul>${s.traits.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="block"><h3>工具／技術</h3><p>${s.tools}</p></div>
      <div class="block fact"><h3>💡 冷知識</h3><p>${s.fact}</p></div>
    `;
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === EVOLUTION_STAGES.length - 1;
  }

  // ---------- 控制項 ----------
  zoomSlider.addEventListener('input', () => { zoom = parseFloat(zoomSlider.value); });
  btnBack.addEventListener('click', exitScene);
  btnPrev.addEventListener('click', () => go(-1));
  btnNext.addEventListener('click', () => go(1));
  window.addEventListener('keydown', (e) => {
    if (mode === 'scene') {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') exitScene();
    } else if (e.key === 'Enter') enterScene(current);
  });

  // ---------- 主迴圈 ----------
  function loop(ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;
    if (mode === 'overview') drawTimeline(t);
    else renderer.draw(EVOLUTION_STAGES[current], t, zoom, view);
    requestAnimationFrame(loop);
  }

  // ---------- 啟動 ----------
  resize();
  // 對外暴露少量狀態供測試/接手除錯（見 HANDOFF §測試）
  window.__evo = {
    get mode() { return mode; },
    get current() { return current; },
    get zoom() { return zoom; },
    enterScene, exitScene, go,
    stages: EVOLUTION_STAGES
  };
  requestAnimationFrame(loop);
})();
