/* =============================================================================
 * scenes.js — 美術層（程序化向量繪圖，零外部圖檔）
 * -----------------------------------------------------------------------------
 * 紅線：本專案「拒絕照片貼圖」，所有畫面都用 Canvas 即時畫出來。
 *
 * 對外只暴露兩個東西：
 *   SceneRenderer(canvas)         — 建立一個渲染器
 *     .draw(stage, t, zoom, cam)  — 畫某個演化階段的場景（t=動畫時間秒，zoom=近看倍率）
 *   drawFigure(ctx, x, y, s, fig, t) — 單獨畫一個人物（時間軸縮圖也會用）
 *
 * 設計重點：用 stage.figure 的參數畫「同一具會演化的身體」——
 * 觀眾切換階段時，會親眼看到：彎腰變直立、腦殼變大、體毛消失、手上工具改變。
 * 這是本教材最核心的視覺教學裝置。
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---------- 小工具 ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(seed) { // 穩定亂數（同 seed 同結果，避免每幀跳動）
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  function skyGradient(ctx, w, h, colors) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.55, colors[1]);
    g.addColorStop(1, colors[2]);
    return g;
  }

  /* =========================================================================
   * 人物：一具「會演化」的身體（側面）
   * fig: {stoop, brain, brow, fur, height, tool, clothing}
   * ======================================================================= */
  function drawFigure(ctx, x, y, s, fig, t) {
    ctx.save();
    ctx.translate(x, y);
    const sway = Math.sin(t * 1.6) * 0.02 * (1 - fig.stoop); // 呼吸/站姿微擺
    ctx.rotate(sway);

    const H = 150 * s * lerp(0.7, 1.0, fig.height); // 全身高
    const stoop = fig.stoop;                         // 前傾
    const skin = fig.fur > 0.5 ? '#6b4a32' : '#8a5a3c';
    const furCol = '#4a3320';

    // 幾何錨點（往上為負 y，腳在 0）
    const hipY = -H * 0.5;
    const shoulderY = -H * lerp(0.78, 0.86, 1 - stoop);
    const headY = -H * lerp(0.86, 1.0, 1 - stoop);
    const lean = stoop * H * 0.28; // 上半身前傾位移

    // --- 腿 ---
    ctx.strokeStyle = skin;
    ctx.lineWidth = 9 * s * lerp(0.8, 1.1, fig.height);
    ctx.lineCap = 'round';
    const legSwing = Math.sin(t * 1.2) * 6 * s;
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(-4 * s + legSwing, -H * 0.24); ctx.lineTo(-2 * s + legSwing, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(6 * s - legSwing, -H * 0.24); ctx.lineTo(9 * s - legSwing, 0); ctx.stroke();

    // --- 軀幹 ---
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(-stoop * 0.5); // 前傾讓脊椎斜
    const torso = ctx.createLinearGradient(0, 0, 0, shoulderY - hipY);
    torso.addColorStop(0, skin);
    torso.addColorStop(1, fig.fur > 0.5 ? furCol : skin);
    ctx.strokeStyle = torso;
    ctx.lineWidth = 13 * s * lerp(0.85, 1.15, fig.height);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lean * 0.3, shoulderY - hipY); ctx.stroke();

    // 衣物
    if (fig.clothing !== 'none') {
      ctx.fillStyle = fig.clothing === 'tailored' ? '#7a5a3a'
        : fig.clothing === 'furwrap' ? '#8a8278' : '#6a4a30';
      ctx.beginPath();
      ctx.moveTo(-9 * s, (shoulderY - hipY) * 0.15);
      ctx.lineTo(9 * s, (shoulderY - hipY) * 0.15);
      ctx.lineTo(11 * s, (shoulderY - hipY) * 0.7);
      ctx.lineTo(-11 * s, (shoulderY - hipY) * 0.7);
      ctx.closePath(); ctx.fill();
      if (fig.clothing === 'furwrap') { // 毛邊
        ctx.strokeStyle = '#cfc8ba'; ctx.lineWidth = 3 * s;
        ctx.stroke();
      }
    }
    ctx.restore();

    // --- 手臂 + 工具 ---
    const sx = lean * 0.3, sy = shoulderY;
    ctx.strokeStyle = skin;
    ctx.lineWidth = 7 * s;
    // 後臂
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx - 10 * s, sy + H * 0.14); ctx.lineTo(sx - 6 * s, sy + H * 0.3); ctx.stroke();
    // 前臂（持工具）
    const armSwing = Math.sin(t * 1.2 + 1) * 4 * s;
    const handX = sx + 14 * s + armSwing, handY = sy + H * 0.26;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 12 * s, sy + H * 0.12); ctx.lineTo(handX, handY); ctx.stroke();
    drawTool(ctx, handX, handY, s, fig.tool, t);

    // --- 脖子（連接肩與頭）---
    ctx.strokeStyle = skin; ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, headY + 8 * s); ctx.stroke();

    // --- 頭（重點：腦殼隨 brain 變大，眉脊隨 brow 突出，額頭隨演化變高）---
    // 頭心 = 肩上一點（單次位移，別重複平移否則頭會飛到畫面外）
    ctx.save();
    ctx.translate(sx, headY);
    const brainR = 12 * s * lerp(0.75, 1.25, fig.brain);
    // 顱骨
    ctx.fillStyle = skin;
    ctx.beginPath();
    // 後腦（越演化越圓、越高）
    ctx.ellipse(-2 * s, -brainR * 0.2, brainR, brainR * lerp(0.85, 1.05, fig.brain), 0, 0, Math.PI * 2);
    ctx.fill();
    // 臉部（口鼻突出隨演化收回）
    const muzzle = lerp(10 * s, 2 * s, fig.brain);
    ctx.beginPath();
    ctx.moveTo(brainR * 0.5, -brainR * 0.3);
    ctx.quadraticCurveTo(brainR * 0.5 + muzzle, 0, brainR * 0.4, brainR * 0.7);
    ctx.quadraticCurveTo(0, brainR * 0.8, -brainR * 0.3, brainR * 0.6);
    ctx.lineTo(-brainR * 0.3, -brainR * 0.2);
    ctx.closePath(); ctx.fill();
    // 眉脊
    if (fig.brow > 0.1) {
      ctx.strokeStyle = 'rgba(40,25,15,0.55)';
      ctx.lineWidth = (1.5 + fig.brow * 3) * s;
      ctx.beginPath();
      ctx.moveTo(-brainR * 0.1, -brainR * 0.05);
      ctx.lineTo(brainR * 0.5 + muzzle * 0.4, -brainR * 0.1);
      ctx.stroke();
    }
    // 眼
    ctx.fillStyle = '#1a1008';
    ctx.beginPath(); ctx.arc(brainR * 0.35 + muzzle * 0.3, brainR * 0.02, 1.6 * s, 0, Math.PI * 2); ctx.fill();
    // 體毛（頭髮/鬃毛）
    if (fig.fur > 0.2) {
      ctx.strokeStyle = 'rgba(40,30,20,0.5)';
      ctx.lineWidth = 1.2 * s;
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * (0.9 + i * 0.09);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * brainR, -brainR * 0.2 + Math.sin(a) * brainR);
        ctx.lineTo(Math.cos(a) * brainR * (1 + fig.fur * 0.35), -brainR * 0.2 + Math.sin(a) * brainR * (1 + fig.fur * 0.35));
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.restore();
  }

  function drawTool(ctx, x, y, s, tool, t) {
    if (tool === 'none') return;
    ctx.save(); ctx.translate(x, y);
    if (tool === 'stone') {
      ctx.fillStyle = '#7a7168';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7 * s, -3 * s); ctx.lineTo(9 * s, 3 * s); ctx.lineTo(2 * s, 5 * s); ctx.closePath(); ctx.fill();
    } else if (tool === 'handaxe') {
      ctx.fillStyle = '#8a8078';
      ctx.beginPath(); ctx.moveTo(0, -2 * s); ctx.lineTo(6 * s, 0); ctx.lineTo(3 * s, 14 * s); ctx.lineTo(-1 * s, 12 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(2 * s, 2 * s); ctx.lineTo(1 * s, 10 * s); ctx.stroke();
    } else if (tool === 'spear') {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(0, -30 * s); ctx.lineTo(0, 30 * s); ctx.stroke();
      ctx.fillStyle = '#9a9088';
      ctx.beginPath(); ctx.moveTo(0, -42 * s); ctx.lineTo(-3 * s, -30 * s); ctx.lineTo(3 * s, -30 * s); ctx.closePath(); ctx.fill();
    } else if (tool === 'torch') {
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 18 * s); ctx.stroke();
      const fl = 4 + Math.sin(t * 12) * 2;
      const g = ctx.createRadialGradient(0, -4 * s, 0, 0, -4 * s, fl * s);
      g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4 * s, fl * s, 0, Math.PI * 2); ctx.fill();
    } else if (tool === 'brush') {
      ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6 * s, 10 * s); ctx.stroke();
      ctx.fillStyle = '#b02a1a'; ctx.beginPath(); ctx.arc(6 * s, 11 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* =========================================================================
   * 環境元件
   * ======================================================================= */
  function drawSun(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, col); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawAcacia(ctx, x, y, s) {
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40 * s);
    ctx.moveTo(x, y - 30 * s); ctx.lineTo(x - 14 * s, y - 44 * s);
    ctx.moveTo(x, y - 30 * s); ctx.lineTo(x + 14 * s, y - 44 * s); ctx.stroke();
    ctx.fillStyle = 'rgba(70,90,40,0.9)';
    ctx.beginPath(); ctx.ellipse(x, y - 48 * s, 30 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,110,55,0.7)';
    ctx.beginPath(); ctx.ellipse(x, y - 52 * s, 22 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawConifer(ctx, x, y, s, col) {
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(x - 2 * s, y - 12 * s, 4 * s, 14 * s);
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const yy = y - 12 * s - i * 12 * s, wd = (22 - i * 5) * s;
      ctx.beginPath(); ctx.moveTo(x, yy - 16 * s); ctx.lineTo(x - wd, yy); ctx.lineTo(x + wd, yy); ctx.closePath(); ctx.fill();
    }
  }

  function drawGrass(ctx, y0, w, col, t, density) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    for (let i = 0; i < density; i++) {
      const x = rand(i * 3.1) * w;
      const h = 8 + rand(i * 7.7) * 16;
      const sw = Math.sin(t * 1.5 + i) * 3;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + sw, y0 - h * 0.6, x + sw * 1.5, y0 - h); ctx.stroke();
    }
  }

  function drawFire(ctx, x, y, s, t) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 90 * s);
    glow.addColorStop(0, 'rgba(255,180,80,0.55)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 90 * s, 0, Math.PI * 2); ctx.fill();
    // 柴薪
    ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x - 14 * s, y + 4 * s); ctx.lineTo(x + 14 * s, y - 2 * s);
    ctx.moveTo(x + 14 * s, y + 4 * s); ctx.lineTo(x - 14 * s, y - 2 * s); ctx.stroke();
    // 火焰
    for (let i = 0; i < 5; i++) {
      const fx = x + (rand(i) - 0.5) * 16 * s;
      const flick = Math.sin(t * 10 + i * 2) * 6;
      const fh = (26 + flick) * s;
      const g = ctx.createLinearGradient(fx, y, fx, y - fh);
      g.addColorStop(0, '#ff5a10'); g.addColorStop(0.6, '#ffb020'); g.addColorStop(1, 'rgba(255,240,160,0.1)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx - 6 * s, y);
      ctx.quadraticCurveTo(fx - 3 * s, y - fh * 0.6, fx, y - fh);
      ctx.quadraticCurveTo(fx + 3 * s, y - fh * 0.6, fx + 6 * s, y);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawMountain(ctx, x, base, w, h, col, snow) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.moveTo(x - w * 0.3, base - h * 0.7); ctx.lineTo(x, base - h); ctx.lineTo(x + w * 0.3, base - h * 0.7);
      ctx.lineTo(x + w * 0.1, base - h * 0.6); ctx.lineTo(x, base - h * 0.72); ctx.lineTo(x - w * 0.1, base - h * 0.6); ctx.closePath(); ctx.fill();
    }
  }

  function drawSnow(ctx, w, h, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 80; i++) {
      const x = (rand(i) * w + t * 20 * (0.5 + rand(i * 2))) % w;
      const y = (rand(i * 3) * h + t * 40 * (0.5 + rand(i * 5))) % h;
      ctx.beginPath(); ctx.arc(x, y, 1 + rand(i * 7) * 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMammoth(ctx, x, y, s) {
    ctx.fillStyle = '#5a4632';
    ctx.beginPath(); ctx.ellipse(x, y - 30 * s, 42 * s, 28 * s, 0, 0, Math.PI * 2); ctx.fill(); // 身
    ctx.beginPath(); ctx.ellipse(x - 40 * s, y - 34 * s, 20 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill(); // 頭
    ctx.fillRect(x - 30 * s, y - 10 * s, 8 * s, 14 * s); // 腿
    ctx.fillRect(x + 20 * s, y - 10 * s, 8 * s, 14 * s);
    ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 8 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 52 * s, y - 30 * s); ctx.quadraticCurveTo(x - 62 * s, y, x - 50 * s, y + 6 * s); ctx.stroke(); // 鼻
    ctx.fillStyle = '#e8e0d0'; // 象牙
    ctx.beginPath(); ctx.moveTo(x - 52 * s, y - 18 * s); ctx.quadraticCurveTo(x - 70 * s, y + 10 * s, x - 48 * s, y + 8 * s); ctx.lineTo(x - 50 * s, y - 16 * s); ctx.closePath(); ctx.fill();
  }

  function drawHandprint(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.4;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 11 * s, 2 * s, 5 * s, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAurochs(ctx, x, y, s, col) { // 洞穴壁畫的野牛
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 34 * s, y - 6 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 40 * s, y - 14 * s); ctx.quadraticCurveTo(x - 50 * s, y - 24 * s, x - 42 * s, y - 26 * s); ctx.stroke(); // 角
    for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * 18 * s, y + 14 * s); ctx.lineTo(x + i * 18 * s, y + 30 * s); ctx.stroke(); }
  }

  /* =========================================================================
   * 場景總表：scene 代號 -> 畫法
   * 每個場景畫「天、遠景、地、道具、人物」。cam 給時間軸平移用。
   * ======================================================================= */
  const SCENES = {
    lakeforest(ctx, w, h, stage, t) {
      const gy = h * 0.72;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.75, h * 0.32, 26, '#ffd98a');
      // 遠山
      drawMountain(ctx, w * 0.3, gy, w * 0.35, h * 0.28, 'rgba(90,70,60,0.6)');
      // 湖面
      const lake = ctx.createLinearGradient(0, gy, 0, h); lake.addColorStop(0, '#8a6a4a'); lake.addColorStop(1, '#4a3828');
      ctx.fillStyle = lake; ctx.fillRect(0, gy, w, h - gy);
      ctx.fillStyle = 'rgba(255,220,150,0.15)';
      for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.5, gy + 6 + i * 8 + Math.sin(t + i) * 2, w * 0.4, 2);
      // 前景樹叢
      for (let i = 0; i < 4; i++) drawAcacia(ctx, w * (0.08 + i * 0.06), gy + 4, 0.8 + rand(i) * 0.3);
      drawFigure(ctx, w * 0.62, gy + 2, 1.1, stage.figure, t);
    },
    woodland(ctx, w, h, stage, t) {
      const gy = h * 0.74;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.2, h * 0.24, 22, '#eaf2c0');
      ctx.fillStyle = '#4f6b34'; ctx.fillRect(0, gy, w, h - gy);
      for (let i = 0; i < 7; i++) drawConifer(ctx, w * (0.1 + i * 0.13), gy + 6, 1 + rand(i) * 0.5, '#3f5a2a');
      drawGrass(ctx, gy + 20, w, 'rgba(90,120,50,0.8)', t, 60);
      drawFigure(ctx, w * 0.55, gy + 10, 1.05, stage.figure, t);
    },
    savanna(ctx, w, h, stage, t) {
      const gy = h * 0.7;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.7, h * 0.28, 30, '#ffcf7a');
      drawMountain(ctx, w * 0.85, gy, w * 0.28, h * 0.3, 'rgba(120,80,50,0.5)'); // 遠火山
      const gr = ctx.createLinearGradient(0, gy, 0, h); gr.addColorStop(0, '#b09a4a'); gr.addColorStop(1, '#6a5a2a');
      ctx.fillStyle = gr; ctx.fillRect(0, gy, w, h - gy);
      drawAcacia(ctx, w * 0.2, gy + 6, 1.3);
      drawAcacia(ctx, w * 0.82, gy + 10, 1.0);
      drawGrass(ctx, gy + 30, w, 'rgba(150,130,60,0.85)', t, 90);
      drawFigure(ctx, w * 0.52, gy + 20, 1.05, stage.figure, t);
    },
    savanna_tools(ctx, w, h, stage, t) {
      SCENES.savanna(ctx, w, h, stage, t);
      const gy = h * 0.7;
      // 地上一堆石器
      ctx.fillStyle = '#8a8178';
      for (let i = 0; i < 5; i++) {
        const x = w * 0.62 + i * 9, y = gy + 34 + (i % 2) * 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y - 3); ctx.lineTo(x + 8, y + 3); ctx.closePath(); ctx.fill();
      }
    },
    firecamp(ctx, w, h, stage, t) {
      const gy = h * 0.72;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      // 星
      ctx.fillStyle = 'rgba(255,240,200,0.6)';
      for (let i = 0; i < 40; i++) ctx.fillRect(rand(i) * w, rand(i * 2) * h * 0.4, 1.5, 1.5);
      ctx.fillStyle = '#2a1c12'; ctx.fillRect(0, gy, w, h - gy);
      for (let i = 0; i < 5; i++) drawConifer(ctx, w * (0.05 + i * 0.22), gy + 4, 1.2, '#1f1710');
      drawFire(ctx, w * 0.5, gy + 30, 1.3, t);
      // 圍火的兩個身影
      drawFigure(ctx, w * 0.36, gy + 24, 0.9, stage.figure, t + 1);
      drawFigure(ctx, w * 0.64, gy + 24, 0.95, { ...stage.figure, tool: 'none' }, t + 2.3);
    },
    coldforest(ctx, w, h, stage, t) {
      const gy = h * 0.74;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawMountain(ctx, w * 0.7, gy, w * 0.4, h * 0.4, 'rgba(90,110,120,0.55)', true);
      ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0, gy, w, h - gy);
      for (let i = 0; i < 8; i++) drawConifer(ctx, w * (0.06 + i * 0.12), gy + 6, 1.1 + rand(i) * 0.4, '#2f4a34');
      // 遠處一隻獵物
      ctx.fillStyle = 'rgba(80,60,40,0.8)';
      ctx.beginPath(); ctx.ellipse(w * 0.8, gy + 18, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
      drawFigure(ctx, w * 0.42, gy + 14, 1.05, stage.figure, t);
    },
    iceage(ctx, w, h, stage, t) {
      const gy = h * 0.76;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawMountain(ctx, w * 0.25, gy, w * 0.4, h * 0.45, 'rgba(150,165,180,0.7)', true);
      drawMountain(ctx, w * 0.75, gy, w * 0.35, h * 0.38, 'rgba(130,150,170,0.6)', true);
      const snow = ctx.createLinearGradient(0, gy, 0, h); snow.addColorStop(0, '#e8f0f5'); snow.addColorStop(1, '#b8c8d2');
      ctx.fillStyle = snow; ctx.fillRect(0, gy, w, h - gy);
      drawMammoth(ctx, w * 0.78, gy + 24, 1.0);
      drawFigure(ctx, w * 0.4, gy + 18, 1.0, stage.figure, t);
      drawSnow(ctx, w, h, t);
    },
    caveart(ctx, w, h, stage, t) {
      // 洞穴內壁
      const rock = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.7);
      rock.addColorStop(0, '#6a4a30'); rock.addColorStop(1, '#241812');
      ctx.fillStyle = rock; ctx.fillRect(0, 0, w, h);
      // 壁畫（赭紅/黑）
      drawAurochs(ctx, w * 0.35, h * 0.42, 1.2, 'rgba(150,50,30,0.9)');
      drawAurochs(ctx, w * 0.62, h * 0.5, 0.8, 'rgba(30,20,15,0.85)');
      drawHandprint(ctx, w * 0.2, h * 0.3, 1.4, 'rgba(180,70,40,0.8)');
      drawHandprint(ctx, w * 0.8, h * 0.35, 1.1, 'rgba(40,30,25,0.75)');
      // 火把光暈隨時間搖
      const gx = w * 0.5 + Math.sin(t) * 20;
      const glow = ctx.createRadialGradient(gx, h * 0.7, 20, gx, h * 0.7, w * 0.5);
      glow.addColorStop(0, 'rgba(255,180,90,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      // 畫家
      drawFigure(ctx, w * 0.5, h * 0.88, 1.1, stage.figure, t);
      drawFire(ctx, w * 0.16, h * 0.86, 0.9, t);
    },
    farmland(ctx, w, h, stage, t) {
      const gy = h * 0.62;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.8, h * 0.24, 28, '#fff0c0');
      // 田地條紋
      const soil = ctx.createLinearGradient(0, gy, 0, h); soil.addColorStop(0, '#9a7a3a'); soil.addColorStop(1, '#6a5220');
      ctx.fillStyle = soil; ctx.fillRect(0, gy, w, h - gy);
      ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.lineWidth = 2;
      for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, gy + i * (h - gy) / 8); ctx.lineTo(w, gy + i * (h - gy) / 8); ctx.stroke(); }
      // 麥
      ctx.strokeStyle = '#c8a848'; ctx.lineWidth = 2;
      for (let i = 0; i < 120; i++) { const x = rand(i) * w, yy = gy + 10 + rand(i * 2) * (h - gy - 20); const sw = Math.sin(t + i) * 2; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + sw, yy - 12); ctx.stroke(); }
      // 小屋
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(w * 0.12, gy - 34, 46, 34);
      ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.moveTo(w * 0.12 - 6, gy - 34); ctx.lineTo(w * 0.12 + 23, gy - 52); ctx.lineTo(w * 0.12 + 52, gy - 34); ctx.closePath(); ctx.fill();
      drawFigure(ctx, w * 0.55, gy + 30, 1.05, stage.figure, t);
    }
  };

  /* =========================================================================
   * Renderer
   * ======================================================================= */
  function SceneRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    this.canvas = canvas; this.ctx = ctx;

    this.draw = function (stage, t, zoom, cam) {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      // 近看：以人物為中心放大
      if (zoom && zoom > 1.001) {
        ctx.translate(w * 0.5, h * 0.72);
        ctx.scale(zoom, zoom);
        ctx.translate(-w * 0.52, -h * 0.72);
      }
      const fn = SCENES[stage.scene] || SCENES.savanna;
      fn(ctx, w, h, stage, t);
      ctx.restore();
      // 近看時右下角加「解剖放大鏡」提示的頭骨特寫
      if (zoom && zoom > 1.8) drawSkullInset(ctx, w - 130, h - 130, stage);
    };
  }

  function drawSkullInset(ctx, x, y, stage) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(20,16,12,0.75)';
    ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 62, 0, Math.PI * 2); ctx.clip();
    // 放大的頭骨（用 figure 參數）
    const fig = { ...stage.figure, height: 1 };
    ctx.translate(x, y + 30); ctx.scale(2.4, 2.4);
    drawFigure(ctx, 0, 0, 1, { ...fig, tool: 'none', clothing: 'none' }, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,220,160,0.85)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('腦容量 ' + stage.brainCc + ' cc', x, y + 50);
  }

  global.SceneRenderer = SceneRenderer;
  global.drawFigure = drawFigure;
})(window);
