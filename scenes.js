/* =============================================================================
 * scenes.js — 美術層（程序化向量繪圖，零外部圖檔）v2 寫實化重製
 * -----------------------------------------------------------------------------
 * 紅線：本專案「拒絕照片貼圖」，所有畫面都用 Canvas 即時畫出來。
 *
 * 對外 API（不可變，data.js / app.js 依賴）：
 *   SceneRenderer(canvas).draw(stage, t, zoom, cam)
 *   drawFigure(ctx, x, y, s, fig, t)
 *
 * v2 目標：從火柴人 → 有體積、有明暗、有解剖結構的側面人物：
 *   - 四肢是有陰影的圓柱（亮面/暗面/反光），不是線。
 *   - 軀幹是漸層填充的塊面，有胸腹起伏。
 *   - 頭部是真實側臉輪廓：額頭斜度、眉脊、鼻、唇、下巴隨演化改變。
 *   - 毛髮是柔和塊面（不是放射刺）。
 *   - 落地陰影、大氣層次遠山、有明暗的樹與草。
 * 光源統一：右上方暖光（lightSide = +1，右側為亮面）。
 * ========================================================================== */

(function (global) {
  'use strict';

  /* ---------- 顏色與數學小工具 ---------- */
  function shade(hex, amt) { // amt>0 提亮(趨白)，amt<0 加深(趨黑)
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const to = amt < 0 ? 0 : 255, p = Math.min(1, Math.abs(amt));
    r = Math.round(r + (to - r) * p); g = Math.round(g + (to - g) * p); b = Math.round(b + (to - b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

  function skyGradient(ctx, w, h, colors) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, colors[0]); g.addColorStop(0.55, colors[1]); g.addColorStop(1, colors[2]);
    return g;
  }

  /* 有明暗的圓柱肢體（wA/wB=兩端半徑）：圓頭粗線當主體，再疊亮面/暗面描邊 → 乾淨的立體感。
     lit=+1 右側為亮面。 */
  function limb(ctx, ax, ay, bx, by, wA, wB, base, lit) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const wid = wA + wB; // 近似平均直徑
    ctx.lineCap = 'round';
    // 主體
    ctx.strokeStyle = base; ctx.lineWidth = wid;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    // 暗面（背光側）——柔化：低透明度、細一點、貼邊
    ctx.save(); ctx.globalAlpha = 0.55;
    ctx.strokeStyle = shade(base, -0.22); ctx.lineWidth = wid * 0.34;
    ctx.beginPath();
    ctx.moveTo(ax - nx * wA * 0.68 * lit, ay - ny * wA * 0.68 * lit);
    ctx.lineTo(bx - nx * wB * 0.68 * lit, by - ny * wB * 0.68 * lit); ctx.stroke();
    ctx.restore();
    // 亮面（受光側）——柔化反光
    ctx.save(); ctx.globalAlpha = 0.6;
    ctx.strokeStyle = shade(base, 0.22); ctx.lineWidth = wid * 0.26;
    ctx.beginPath();
    ctx.moveTo(ax + nx * wA * 0.5 * lit, ay + ny * wA * 0.5 * lit);
    ctx.lineTo(bx + nx * wB * 0.5 * lit, by + ny * wB * 0.5 * lit); ctx.stroke();
    ctx.restore();
  }

  /* 體毛紋理：在區域內鋪短而細的毛（僅作表面質感，非放射長刺） */
  function furPatch(ctx, cx, cy, r, dir, amount, color) {
    if (amount <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = 0.35 * amount;
    ctx.strokeStyle = color; ctx.lineCap = 'round';
    const n = Math.round(amount * 18);
    for (let i = 0; i < n; i++) {
      const a = dir + (rand(i * 1.3 + cx) - 0.5) * 0.9;   // 收斂方向，順毛流
      const len = r * (0.25 + rand(i * 2.7) * 0.4);        // 短
      const ox = (rand(i * 3.1) - 0.5) * r * 1.4, oy = (rand(i * 4.7) - 0.5) * r * 1.4;
      ctx.lineWidth = 0.8 + rand(i) * 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy);
      ctx.lineTo(cx + ox + Math.cos(a) * len, cy + oy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 頭髮：實心塊面（依 fur 決定覆蓋範圍），非一根根刺 */
  function drawHair(ctx, braceR, forehead, fur, hairCol) {
    const hx = braceR * 0.55 * forehead;         // 髮線（額頂）x
    const backY = lerp(-braceR * 0.5, braceR * 0.55, fur); // fur 越高、後方頭髮越長（下垂到頸）
    const g = ctx.createLinearGradient(0, -braceR, 0, braceR * 0.5);
    g.addColorStop(0, shade(hairCol, 0.12)); g.addColorStop(1, shade(hairCol, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-braceR * 0.62, -braceR * 0.5);
    ctx.quadraticCurveTo(-braceR * 0.2, -braceR * 1.18, hx * 0.95, -braceR * 0.92); // 越過頭頂到髮線
    ctx.quadraticCurveTo(hx * 0.65, -braceR * 0.7, hx * 0.55, -braceR * 0.5);        // 髮線下緣
    ctx.quadraticCurveTo(-braceR * 0.1, -braceR * 0.72, -braceR * 0.55, backY * 0.4 - braceR * 0.2); // 內收
    ctx.quadraticCurveTo(-braceR * 0.85, backY, -braceR * 0.62, -braceR * 0.5);      // 後方下垂
    ctx.closePath(); ctx.fill();
    // 蓬鬆邊緣（少量短毛，順著髮流）
    if (fur > 0.35) {
      furPatch(ctx, -braceR * 0.5, backY * 0.5 - braceR * 0.2, braceR * 0.4, 1.9, fur, hairCol);
      furPatch(ctx, -braceR * 0.1, -braceR * 0.95, braceR * 0.5, -1.3, fur * 0.7, hairCol);
    }
    // 高光
    ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = shade(hairCol, 0.35); ctx.lineWidth = braceR * 0.06;
    ctx.beginPath(); ctx.moveTo(-braceR * 0.15, -braceR * 0.95); ctx.quadraticCurveTo(hx * 0.6, -braceR * 0.9, hx * 0.7, -braceR * 0.6); ctx.stroke();
    ctx.restore();
  }

  /* =========================================================================
   * 人物：有體積、有明暗、有解剖的側面身體（面向右）
   * fig: {stoop, brain, brow, fur, height, tool, clothing}
   * (x,y)=腳底，往上為負 y。
   * ======================================================================= */
  function drawFigure(ctx, x, y, s, fig, t) {
    const H = 168 * s * lerp(0.72, 1.0, fig.height);
    const lit = 1; // 右上光
    // 膚色（越早越偏深褐/紅褐）
    const skin = fig.fur > 0.55 ? '#7a5236' : (fig.fur > 0.2 ? '#8a5c3c' : '#a06a45');
    const hairCol = '#2c1d12';
    const step = Math.sin(t * 1.1) * 0.5; // 緩慢重心擺動 -0.5..0.5

    ctx.save();
    ctx.translate(x, y);

    // 落地陰影
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 0, H * 0.20, H * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 呼吸微擺
    ctx.rotate(Math.sin(t * 1.4) * 0.012 * (1 - fig.stoop));

    // ---- 關鍵點（相對腳底，往上為負）----
    const hipY = -H * 0.50, hipX = 0;
    const lean = fig.stoop; // 0 直立 … 1 前傾
    // 上半身前傾：肩往前(+x)、往下
    const shoulderX = hipX + lean * H * 0.20, shoulderY = -H * (0.80 - lean * 0.10);
    const neckY = -H * (0.85 - lean * 0.10), neckX = shoulderX + 1 * s;
    const headX = neckX + lean * H * 0.06 + 2 * s, headY = -H * (0.93 - lean * 0.10);

    // ================= 遠側腿（在後、較暗）=================
    const farKneeX = -H * 0.06 + step * H * 0.05, farKneeY = -H * 0.27;
    const farAnkX = -H * 0.10 + step * H * 0.06, farAnkY = -H * 0.03;
    limb(ctx, hipX, hipY, farKneeX, farKneeY, H * 0.058, H * 0.05, shade(skin, -0.14), lit);
    limb(ctx, farKneeX, farKneeY, farAnkX, farAnkY, H * 0.05, H * 0.035, shade(skin, -0.14), lit);
    foot(ctx, farAnkX, farAnkY, H, shade(skin, -0.16), -1);

    // ================= 遠側手臂（在後、較暗）=================
    const farElbowX = shoulderX + H * 0.03 + lean * H * 0.08, farElbowY = shoulderY + H * 0.16;
    const farHandX = shoulderX + H * 0.05 + lean * H * 0.14, farHandY = shoulderY + H * 0.30;
    limb(ctx, shoulderX, shoulderY + H * 0.01, farElbowX, farElbowY, H * 0.045, H * 0.038, shade(skin, -0.16), lit);
    limb(ctx, farElbowX, farElbowY, farHandX, farHandY, H * 0.038, H * 0.03, shade(skin, -0.16), lit);

    // ================= 軀幹（漸層塊面：胸→腹→骨盆）=================
    drawTorso(ctx, hipX, hipY, shoulderX, shoulderY, H, skin, lit);

    // 衣物（覆在軀幹上）
    if (fig.clothing && fig.clothing !== 'none') drawClothing(ctx, hipX, hipY, shoulderX, shoulderY, H, fig.clothing, lit);

    // ================= 頸 =================
    limb(ctx, shoulderX, shoulderY, headX - 1 * s, headY + H * 0.05, H * 0.045, H * 0.04, skin, lit);

    // ================= 頭（真實側臉）=================
    drawHead(ctx, headX, headY, H * 0.135, fig, skin, hairCol, lit, t);

    // ================= 近側腿（在前、較亮）=================
    const kneeX = H * 0.05 - step * H * 0.05, kneeY = -H * 0.27;
    const ankX = H * 0.09 - step * H * 0.06, ankY = -H * 0.02;
    limb(ctx, hipX, hipY, kneeX, kneeY, H * 0.065, H * 0.052, skin, lit);
    limb(ctx, kneeX, kneeY, ankX, ankY, H * 0.052, H * 0.038, skin, lit);
    foot(ctx, ankX, ankY, H, skin, 1);
    furPatch(ctx, kneeX, (kneeY + hipY) / 2, H * 0.05, 1.6, fig.fur * 0.7, hairCol);

    // ================= 近側手臂（在前、較亮，持工具）=================
    const swing = Math.sin(t * 1.1 + 0.6) * H * 0.02;
    const elbowX = shoulderX + H * 0.05 + lean * H * 0.10, elbowY = shoulderY + H * 0.17 + swing;
    const handX = shoulderX + H * 0.09 + lean * H * 0.16, handY = shoulderY + H * 0.31 + swing;
    limb(ctx, shoulderX, shoulderY + H * 0.01, elbowX, elbowY, H * 0.05, H * 0.042, skin, lit);
    limb(ctx, elbowX, elbowY, handX, handY, H * 0.042, H * 0.032, skin, lit);
    // 手掌
    ctx.fillStyle = shade(skin, 0.05);
    ctx.beginPath(); ctx.ellipse(handX, handY, H * 0.03, H * 0.038, 0.4, 0, Math.PI * 2); ctx.fill();
    // 前臂體毛
    furPatch(ctx, (shoulderX + elbowX) / 2, (shoulderY + elbowY) / 2, H * 0.04, 0.5, fig.fur * 0.6, hairCol);

    drawTool(ctx, handX, handY, s * lerp(0.9, 1.25, fig.height), fig.tool, t);

    ctx.restore();
  }

  function foot(ctx, ax, ay, H, col, dir) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(ax + dir * H * 0.035, ay + H * 0.005, H * 0.06, H * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTorso(ctx, hipX, hipY, shX, shY, H, skin, lit) {
    // 側面軀幹輪廓：背(後)較直，胸腹(前)有起伏
    const chestX = shX + H * 0.02, backX = shX - H * 0.09;
    const bellyX = lerp(hipX, shX, 0.4) + H * 0.10;
    ctx.beginPath();
    ctx.moveTo(backX, shY);                                   // 後肩
    ctx.quadraticCurveTo(shX + H * 0.12, shY + H * 0.02, chestX + H * 0.02, shY + H * 0.05); // 胸前
    ctx.quadraticCurveTo(bellyX, shY + H * 0.16, hipX + H * 0.10, hipY);   // 腹→前髖
    ctx.quadraticCurveTo(hipX, hipY + H * 0.03, hipX - H * 0.10, hipY);    // 臀底
    ctx.quadraticCurveTo(backX - H * 0.03, shY + H * 0.14, backX, shY);    // 背回肩
    ctx.closePath();
    const g = ctx.createLinearGradient(chestX + H * 0.12, shY, backX - H * 0.03, shY);
    g.addColorStop(0, shade(skin, 0.16)); g.addColorStop(0.5, skin); g.addColorStop(1, shade(skin, -0.26));
    ctx.fillStyle = g; ctx.fill();
    // 胸肌/腹部陰影暗示
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = shade(skin, -0.5); ctx.lineWidth = H * 0.012;
    ctx.beginPath(); ctx.moveTo(chestX, shY + H * 0.07); ctx.quadraticCurveTo(bellyX - H * 0.02, shY + H * 0.12, hipX + H * 0.05, hipY - H * 0.02); ctx.stroke();
    ctx.restore();
  }

  function drawClothing(ctx, hipX, hipY, shX, shY, H, kind, lit) {
    let col = kind === 'tailored' ? '#7a5638' : kind === 'furwrap' ? '#8f8578' : '#6b4a2e';
    ctx.save();
    ctx.beginPath();
    const topY = kind === 'tailored' ? shY + H * 0.02 : shY + H * 0.10;
    ctx.moveTo(shX - H * 0.10, topY);
    ctx.quadraticCurveTo(shX + H * 0.14, topY + H * 0.02, shX + H * 0.10, topY + H * 0.04);
    ctx.lineTo(hipX + H * 0.12, hipY - H * 0.02);
    ctx.quadraticCurveTo(hipX, hipY + H * 0.04, hipX - H * 0.12, hipY - H * 0.02);
    ctx.closePath();
    const g = ctx.createLinearGradient(shX + H * 0.1, shY, shX - H * 0.12, shY);
    g.addColorStop(0, shade(col, 0.12)); g.addColorStop(1, shade(col, -0.22));
    ctx.fillStyle = g; ctx.fill();
    if (kind === 'furwrap') { // 毛邊
      ctx.strokeStyle = '#d8d0c2'; ctx.lineWidth = H * 0.02; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.7; ctx.stroke();
    }
    ctx.restore();
  }

  /* 頭：面向右的側臉輪廓。腦殼隨 brain 變大變圓、額頭變直；
     brow 眉脊突出；muzzle 口鼻前突（早期大、智人小）；下巴智人明顯。 */
  function drawHead(ctx, cx, cy, R, fig, skin, hairCol, lit, t) {
    const brain = fig.brain, brow = fig.brow;
    const muzzle = lerp(1, 0.12, brain);   // 口鼻前突
    const forehead = lerp(0.35, 0.95, brain); // 額頭直立度
    const chin = lerp(0.1, 1, brain);      // 下巴
    const braceR = R * lerp(0.92, 1.18, brain); // 腦殼大小

    ctx.save();
    ctx.translate(cx, cy);

    // --- 顱骨 + 臉 側面輪廓（origin=頭心，+x 面向前）---
    ctx.beginPath();
    ctx.moveTo(-braceR * 0.55, -braceR * 0.75);                                  // 後腦上
    ctx.quadraticCurveTo(braceR * 0.15, -braceR * 1.12, braceR * 0.55 * forehead, -braceR * 0.82); // 顱頂→額
    // 額頭下滑到眉脊
    ctx.quadraticCurveTo(braceR * (0.7 + forehead * 0.15), -braceR * 0.45,
      braceR * (0.75 + brow * 0.22), -braceR * 0.28);                            // 眉脊突出
    // 鼻梁→鼻尖
    ctx.quadraticCurveTo(braceR * (0.82 + muzzle * 0.15), -braceR * 0.12,
      braceR * (0.98 + muzzle * 0.28), -braceR * 0.02);                          // 鼻尖
    ctx.quadraticCurveTo(braceR * (0.9 + muzzle * 0.2), braceR * 0.08,
      braceR * (0.78 + muzzle * 0.2), braceR * 0.12);                            // 鼻下(人中)
    // 上唇→嘴→下唇（口鼻前突把嘴往前推）
    ctx.quadraticCurveTo(braceR * (0.86 + muzzle * 0.25), braceR * 0.2,
      braceR * (0.74 + muzzle * 0.18), braceR * 0.26);
    // 下巴
    ctx.quadraticCurveTo(braceR * (0.7 + muzzle * 0.1), braceR * 0.42,
      braceR * (0.42 + chin * 0.22 - muzzle * 0.1), braceR * 0.5);               // 下巴尖
    // 下顎→頸
    ctx.quadraticCurveTo(braceR * 0.15, braceR * 0.6, -braceR * 0.25, braceR * 0.5);
    ctx.quadraticCurveTo(-braceR * 0.62, braceR * 0.35, -braceR * 0.72, braceR * 0.02); // 下顎角
    ctx.quadraticCurveTo(-braceR * 0.8, -braceR * 0.4, -braceR * 0.55, -braceR * 0.75); // 後腦
    ctx.closePath();
    const fg = ctx.createLinearGradient(braceR, 0, -braceR, 0);
    fg.addColorStop(0, shade(skin, 0.16)); fg.addColorStop(0.5, skin); fg.addColorStop(1, shade(skin, -0.24));
    ctx.fillStyle = fg; ctx.fill();

    // 眉脊陰影
    if (brow > 0.15) {
      ctx.save(); ctx.globalAlpha = 0.35 * brow; ctx.strokeStyle = shade(skin, -0.6);
      ctx.lineWidth = R * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(braceR * 0.35, -braceR * 0.30); ctx.lineTo(braceR * (0.72 + brow * 0.2), -braceR * 0.26); ctx.stroke();
      ctx.restore();
    }
    // 眼窩 + 眼睛
    ctx.fillStyle = shade(skin, -0.35);
    ctx.beginPath(); ctx.ellipse(braceR * 0.5, -braceR * 0.12, R * 0.12, R * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.ellipse(braceR * 0.54, -braceR * 0.12, R * 0.06, R * 0.055, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(braceR * 0.57, -braceR * 0.15, R * 0.02, 0, Math.PI * 2); ctx.fill();
    // 鼻孔
    ctx.fillStyle = shade(skin, -0.5);
    ctx.beginPath(); ctx.ellipse(braceR * (0.82 + muzzle * 0.2), braceR * 0.04, R * 0.04, R * 0.025, -0.4, 0, Math.PI * 2); ctx.fill();
    // 嘴縫
    ctx.strokeStyle = shade(skin, -0.5); ctx.lineWidth = R * 0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(braceR * (0.62 + muzzle * 0.15), braceR * 0.24); ctx.lineTo(braceR * (0.78 + muzzle * 0.2), braceR * 0.22); ctx.stroke();
    // 耳朵
    ctx.fillStyle = shade(skin, -0.05);
    ctx.beginPath(); ctx.ellipse(-braceR * 0.15, braceR * 0.02, R * 0.12, R * 0.16, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(skin, -0.4);
    ctx.beginPath(); ctx.ellipse(-braceR * 0.15, braceR * 0.03, R * 0.05, R * 0.08, 0.2, 0, Math.PI * 2); ctx.fill();

    // --- 頭髮（實心塊面）+ 濃毛物種的臉頰毛 ---
    if (fig.fur > 0.55) { // 臉頰/下顎濃毛，畫在髮之前（被臉壓住的底層）
      furPatch(ctx, braceR * 0.2, braceR * 0.4, braceR * 0.35, 1.5, fig.fur - 0.4, hairCol);
    }
    drawHair(ctx, braceR, forehead, fig.fur, hairCol);
    ctx.restore();
  }

  function drawTool(ctx, x, y, s, tool, t) {
    if (!tool || tool === 'none') return;
    ctx.save(); ctx.translate(x, y);
    if (tool === 'stone') {
      ctx.fillStyle = '#8a8178';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11 * s, -5 * s); ctx.lineTo(15 * s, 4 * s); ctx.lineTo(4 * s, 8 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(3 * s, 0); ctx.lineTo(11 * s, 1 * s); ctx.stroke();
    } else if (tool === 'handaxe') {
      const g = ctx.createLinearGradient(0, -3 * s, 8 * s, 18 * s);
      g.addColorStop(0, '#b0a89e'); g.addColorStop(1, '#6a625a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -3 * s); ctx.lineTo(9 * s, 2 * s); ctx.lineTo(4 * s, 20 * s); ctx.lineTo(-2 * s, 16 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(2 * s, 2 * s); ctx.lineTo(1 * s, 14 * s); ctx.stroke();
    } else if (tool === 'spear') {
      const g = ctx.createLinearGradient(-2 * s, 0, 2 * s, 0);
      g.addColorStop(0, '#5a3c22'); g.addColorStop(0.5, '#7a5432'); g.addColorStop(1, '#4a3018');
      ctx.strokeStyle = g; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -42 * s); ctx.lineTo(0, 40 * s); ctx.stroke();
      ctx.fillStyle = '#c9c1b6';
      ctx.beginPath(); ctx.moveTo(0, -58 * s); ctx.lineTo(-4 * s, -42 * s); ctx.lineTo(4 * s, -42 * s); ctx.closePath(); ctx.fill();
    } else if (tool === 'torch') {
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22 * s); ctx.stroke();
      const fl = 6 + Math.sin(t * 12) * 2;
      const g = ctx.createRadialGradient(0, -5 * s, 0, 0, -5 * s, fl * s);
      g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -5 * s, fl * s, 0, Math.PI * 2); ctx.fill();
    } else if (tool === 'brush') {
      ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8 * s, 13 * s); ctx.stroke();
      ctx.fillStyle = '#a8321e'; ctx.beginPath(); ctx.arc(8 * s, 14 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* =========================================================================
   * 環境元件（加大氣層次與明暗）
   * ======================================================================= */
  function drawSun(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, col); g.addColorStop(0.25, col); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 大氣遠山（低對比、偏冷、越遠越淡）
  function ridge(ctx, w, baseY, amp, col, seedOff) {
    ctx.beginPath(); ctx.moveTo(0, baseY);
    for (let x = 0; x <= w; x += 24) {
      const yy = baseY - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seedOff) + 0.3 * rand(x + seedOff));
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w, baseY + 200); ctx.lineTo(0, baseY + 200); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  }

  function drawAcacia(ctx, x, gy, s) {
    const g = ctx.createLinearGradient(x, gy - 70 * s, x, gy);
    g.addColorStop(0, '#3f2e1c'); g.addColorStop(1, '#2a1c10');
    ctx.strokeStyle = g; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - 46 * s);
    ctx.moveTo(x, gy - 34 * s); ctx.lineTo(x - 18 * s, gy - 52 * s);
    ctx.moveTo(x, gy - 34 * s); ctx.lineTo(x + 18 * s, gy - 52 * s); ctx.stroke();
    // 傘狀樹冠（多塊漸層）
    for (let i = 0; i < 3; i++) {
      const cx = x + (i - 1) * 20 * s, cy = gy - (54 + i % 2 * 4) * s, rw = 26 * s, rh = 11 * s;
      const cg = ctx.createLinearGradient(cx, cy - rh, cx, cy + rh);
      cg.addColorStop(0, '#6f8a3f'); cg.addColorStop(1, '#3f5222');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTree(ctx, x, gy, s, leaf) {
    // 闊葉/針葉通用：漸層樹幹 + 柔和樹冠塊
    const tg = ctx.createLinearGradient(x - 4 * s, 0, x + 4 * s, 0);
    tg.addColorStop(0, '#3a2818'); tg.addColorStop(1, '#5a4028');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(x - 4 * s, gy); ctx.lineTo(x - 2 * s, gy - 40 * s); ctx.lineTo(x + 2 * s, gy - 40 * s); ctx.lineTo(x + 4 * s, gy); ctx.closePath(); ctx.fill();
    const clumps = [[0, -58, 26], [-16, -46, 20], [16, -48, 20], [0, -76, 20]];
    for (const [dx, dy, r] of clumps) {
      const cx = x + dx * s, cy = gy + dy * s, rr = r * s;
      const cg = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.4, rr * 0.2, cx, cy, rr);
      cg.addColorStop(0, shade(leaf, 0.18)); cg.addColorStop(1, shade(leaf, -0.22));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawConifer(ctx, x, gy, s, leaf) {
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(x - 2.5 * s, gy - 14 * s, 5 * s, 16 * s);
    for (let i = 0; i < 4; i++) {
      const yy = gy - 12 * s - i * 13 * s, wd = (26 - i * 5) * s;
      const cg = ctx.createLinearGradient(x - wd, yy, x + wd, yy);
      cg.addColorStop(0, shade(leaf, -0.2)); cg.addColorStop(0.5, leaf); cg.addColorStop(1, shade(leaf, 0.12));
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(x, yy - 20 * s); ctx.quadraticCurveTo(x - wd * 0.6, yy - 4 * s, x - wd, yy); ctx.lineTo(x + wd, yy); ctx.quadraticCurveTo(x + wd * 0.6, yy - 4 * s, x, yy - 20 * s); ctx.closePath(); ctx.fill();
    }
  }

  // 有明暗的草地表層 + 草叢
  function drawGround(ctx, gy, w, h, top, bottom) {
    const g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, gy, w, h - gy);
    // 地平線暖霧
    const haze = ctx.createLinearGradient(0, gy - 12, 0, gy + 30);
    haze.addColorStop(0, 'rgba(255,240,210,0.35)'); haze.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = haze; ctx.fillRect(0, gy - 12, w, 42);
    // 質感斑點
    ctx.save(); ctx.globalAlpha = 0.10;
    for (let i = 0; i < 140; i++) { const x = rand(i) * w, y = gy + rand(i * 2) * (h - gy); ctx.fillStyle = i % 2 ? '#000' : '#fff'; ctx.fillRect(x, y, 2, 2); }
    ctx.restore();
  }

  function drawGrass(ctx, y0, w, col, t, density) {
    for (let i = 0; i < density; i++) {
      const x = rand(i * 3.1) * w;
      const hh = 10 + rand(i * 7.7) * 20;
      const sw = Math.sin(t * 1.5 + i) * 3;
      ctx.strokeStyle = i % 3 ? col : shade(col, -0.15);
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + sw, y0 - hh * 0.6, x + sw * 1.6, y0 - hh); ctx.stroke();
    }
  }

  function drawFire(ctx, x, y, s, t) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 110 * s);
    glow.addColorStop(0, 'rgba(255,180,80,0.6)'); glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 110 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#33210f'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 16 * s, y + 5 * s); ctx.lineTo(x + 16 * s, y - 2 * s);
    ctx.moveTo(x + 16 * s, y + 5 * s); ctx.lineTo(x - 16 * s, y - 2 * s); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const fx = x + (rand(i) - 0.5) * 18 * s;
      const flick = Math.sin(t * 10 + i * 2) * 6;
      const fh = (30 + flick) * s;
      const g = ctx.createLinearGradient(fx, y, fx, y - fh);
      g.addColorStop(0, '#ff5a10'); g.addColorStop(0.55, '#ffb020'); g.addColorStop(1, 'rgba(255,240,160,0.1)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx - 7 * s, y);
      ctx.quadraticCurveTo(fx - 3 * s, y - fh * 0.6, fx, y - fh);
      ctx.quadraticCurveTo(fx + 3 * s, y - fh * 0.6, fx + 7 * s, y);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawSnowMountain(ctx, x, base, w, hh, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x - w * 0.2, base - hh * 0.7); ctx.lineTo(x, base - hh); ctx.lineTo(x + w * 0.3, base - hh * 0.65); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.moveTo(x - w * 0.28, base - hh * 0.7); ctx.lineTo(x, base - hh); ctx.lineTo(x + w * 0.28, base - hh * 0.66);
    ctx.lineTo(x + w * 0.12, base - hh * 0.58); ctx.lineTo(x, base - hh * 0.72); ctx.lineTo(x - w * 0.1, base - hh * 0.58); ctx.closePath(); ctx.fill();
  }

  function drawSnow(ctx, w, h, t) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 90; i++) {
      const x = (rand(i) * w + t * 18 * (0.5 + rand(i * 2))) % w;
      const y = (rand(i * 3) * h + t * 44 * (0.5 + rand(i * 5))) % h;
      ctx.beginPath(); ctx.arc(x, y, 1 + rand(i * 7) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMammoth(ctx, x, y, s) {
    const g = ctx.createLinearGradient(x, y - 60 * s, x, y + 10 * s);
    g.addColorStop(0, '#6a5238'); g.addColorStop(1, '#3e2e1c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - 34 * s, 48 * s, 32 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 30 * s, y - 60 * s); ctx.quadraticCurveTo(x, y - 74 * s, x + 30 * s, y - 58 * s); ctx.lineTo(x + 30 * s, y - 40 * s); ctx.lineTo(x - 30 * s, y - 42 * s); ctx.closePath(); ctx.fill(); // 隆背
    ctx.beginPath(); ctx.ellipse(x - 46 * s, y - 38 * s, 22 * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade('#4e3a24', -0.05);
    ctx.fillRect(x - 34 * s, y - 12 * s, 9 * s, 18 * s); ctx.fillRect(x + 22 * s, y - 12 * s, 9 * s, 18 * s);
    ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 60 * s, y - 32 * s); ctx.quadraticCurveTo(x - 72 * s, y + 2 * s, x - 56 * s, y + 8 * s); ctx.stroke();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.moveTo(x - 60 * s, y - 18 * s); ctx.quadraticCurveTo(x - 82 * s, y + 14 * s, x - 54 * s, y + 10 * s); ctx.lineTo(x - 56 * s, y - 16 * s); ctx.closePath(); ctx.fill();
  }

  function drawHandprint(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, 7 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 12 * s, 2.2 * s, 6 * s, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAurochs(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, 38 * s, 20 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 38 * s, y - 8 * s, 13 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 44 * s, y - 16 * s); ctx.quadraticCurveTo(x - 56 * s, y - 28 * s, x - 46 * s, y - 30 * s); ctx.stroke();
    for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * 20 * s, y + 16 * s); ctx.lineTo(x + i * 20 * s, y + 34 * s); ctx.stroke(); }
  }

  /* =========================================================================
   * 場景（每個畫 天/大氣遠景/地/道具/人物）
   * ======================================================================= */
  const SCENES = {
    lakeforest(ctx, w, h, stage, t) {
      const gy = h * 0.72;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.74, h * 0.30, 30, '#ffd98a');
      ridge(ctx, w, gy - 30, 70, 'rgba(90,72,60,0.45)', 1);
      ridge(ctx, w, gy - 6, 40, 'rgba(70,56,44,0.6)', 3);
      // 湖
      const lake = ctx.createLinearGradient(0, gy, 0, h); lake.addColorStop(0, '#7a6446'); lake.addColorStop(1, '#3f2f20');
      ctx.fillStyle = lake; ctx.fillRect(0, gy, w, h - gy);
      ctx.fillStyle = 'rgba(255,225,160,0.18)';
      for (let i = 0; i < 7; i++) ctx.fillRect(w * 0.45, gy + 8 + i * 9 + Math.sin(t + i) * 2, w * 0.45, 2);
      for (let i = 0; i < 4; i++) drawTree(ctx, w * (0.08 + i * 0.07), gy + 2, 0.8 + rand(i) * 0.3, '#4a5e2c');
      drawFigure(ctx, w * 0.6, gy + 4, 1.15, stage.figure, t);
    },
    woodland(ctx, w, h, stage, t) {
      const gy = h * 0.74;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.22, h * 0.22, 24, '#eaf2c0');
      ridge(ctx, w, gy, 60, 'rgba(70,90,50,0.4)', 2);
      drawGround(ctx, gy, w, h, '#5a7238', '#33461f');
      for (let i = 0; i < 6; i++) drawTree(ctx, w * (0.1 + i * 0.15), gy + 6, 1 + rand(i) * 0.5, '#4f6b2c');
      drawGrass(ctx, gy + 24, w, '#6a8a3a', t, 70);
      drawFigure(ctx, w * 0.54, gy + 12, 1.1, stage.figure, t);
    },
    savanna(ctx, w, h, stage, t) {
      const gy = h * 0.7;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.72, h * 0.26, 34, '#ffcf7a');
      ridge(ctx, w, gy - 20, 90, 'rgba(120,84,52,0.4)', 4); // 遠火山群
      drawGround(ctx, gy, w, h, '#b39a52', '#5f4e26');
      drawAcacia(ctx, w * 0.2, gy + 6, 1.4);
      drawAcacia(ctx, w * 0.83, gy + 10, 1.05);
      drawGrass(ctx, gy + 32, w, '#a68f4a', t, 100);
      drawFigure(ctx, w * 0.5, gy + 22, 1.12, stage.figure, t);
    },
    savanna_tools(ctx, w, h, stage, t) {
      SCENES.savanna(ctx, w, h, stage, t);
      const gy = h * 0.7;
      ctx.fillStyle = '#8f867c';
      for (let i = 0; i < 5; i++) { const x = w * 0.6 + i * 11, y = gy + 40 + (i % 2) * 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y - 4); ctx.lineTo(x + 10, y + 4); ctx.closePath(); ctx.fill(); }
    },
    firecamp(ctx, w, h, stage, t) {
      const gy = h * 0.72;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,240,200,0.7)';
      for (let i = 0; i < 45; i++) ctx.fillRect(rand(i) * w, rand(i * 2) * h * 0.4, 1.6, 1.6);
      ridge(ctx, w, gy, 50, 'rgba(20,14,10,0.9)', 2);
      const gr = ctx.createLinearGradient(0, gy, 0, h); gr.addColorStop(0, '#2a1c12'); gr.addColorStop(1, '#160f0a');
      ctx.fillStyle = gr; ctx.fillRect(0, gy, w, h - gy);
      for (let i = 0; i < 5; i++) drawConifer(ctx, w * (0.05 + i * 0.22), gy + 4, 1.1, '#1f2712');
      drawFire(ctx, w * 0.5, gy + 34, 1.4, t);
      drawFigure(ctx, w * 0.34, gy + 26, 0.98, stage.figure, t + 1);
      drawFigure(ctx, w * 0.66, gy + 26, 1.02, { ...stage.figure, tool: 'none' }, t + 2.3);
    },
    coldforest(ctx, w, h, stage, t) {
      const gy = h * 0.74;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSnowMountain(ctx, w * 0.68, gy, w * 0.4, h * 0.42, 'rgba(96,116,126,0.55)');
      drawGround(ctx, gy, w, h, '#4a5a42', '#2c3826');
      for (let i = 0; i < 8; i++) drawConifer(ctx, w * (0.06 + i * 0.12), gy + 6, 1.1 + rand(i) * 0.4, '#2f4a30');
      // 遠處獵物
      ctx.fillStyle = 'rgba(70,52,34,0.85)'; ctx.beginPath(); ctx.ellipse(w * 0.82, gy + 20, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
      drawFigure(ctx, w * 0.42, gy + 16, 1.12, stage.figure, t);
    },
    iceage(ctx, w, h, stage, t) {
      const gy = h * 0.76;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSnowMountain(ctx, w * 0.24, gy, w * 0.42, h * 0.46, 'rgba(150,166,182,0.7)');
      drawSnowMountain(ctx, w * 0.76, gy, w * 0.36, h * 0.4, 'rgba(132,152,172,0.6)');
      const snow = ctx.createLinearGradient(0, gy, 0, h); snow.addColorStop(0, '#eaf1f6'); snow.addColorStop(1, '#b4c6d2');
      ctx.fillStyle = snow; ctx.fillRect(0, gy, w, h - gy);
      drawMammoth(ctx, w * 0.78, gy + 26, 1.05);
      drawFigure(ctx, w * 0.4, gy + 18, 1.08, stage.figure, t);
      drawSnow(ctx, w, h, t);
    },
    caveart(ctx, w, h, stage, t) {
      const rock = ctx.createRadialGradient(w * 0.5, h * 0.55, 40, w * 0.5, h * 0.5, w * 0.75);
      rock.addColorStop(0, '#7a5636'); rock.addColorStop(1, '#241812');
      ctx.fillStyle = rock; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalAlpha = 0.12;
      for (let i = 0; i < 60; i++) { ctx.fillStyle = i % 2 ? '#000' : '#c98'; ctx.fillRect(rand(i) * w, rand(i * 2) * h, 3, 3); }
      ctx.restore();
      drawAurochs(ctx, w * 0.33, h * 0.4, 1.25, 'rgba(150,52,30,0.92)');
      drawAurochs(ctx, w * 0.63, h * 0.5, 0.82, 'rgba(34,22,16,0.88)');
      drawHandprint(ctx, w * 0.19, h * 0.3, 1.5, 'rgba(180,72,42,0.82)');
      drawHandprint(ctx, w * 0.82, h * 0.34, 1.15, 'rgba(40,30,25,0.78)');
      const gx = w * 0.16 + Math.sin(t) * 8;
      const glow = ctx.createRadialGradient(gx, h * 0.8, 20, gx, h * 0.7, w * 0.55);
      glow.addColorStop(0, 'rgba(255,180,90,0.32)'); glow.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      drawFigure(ctx, w * 0.5, h * 0.9, 1.2, stage.figure, t);
      drawFire(ctx, w * 0.16, h * 0.88, 0.95, t);
    },
    farmland(ctx, w, h, stage, t) {
      const gy = h * 0.62;
      ctx.fillStyle = skyGradient(ctx, w, h, stage.palette.sky); ctx.fillRect(0, 0, w, h);
      drawSun(ctx, w * 0.8, h * 0.22, 30, '#fff0c0');
      ridge(ctx, w, gy, 40, 'rgba(120,150,90,0.4)', 2);
      const soil = ctx.createLinearGradient(0, gy, 0, h); soil.addColorStop(0, '#9c7c3c'); soil.addColorStop(1, '#6a5220');
      ctx.fillStyle = soil; ctx.fillRect(0, gy, w, h - gy);
      ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 2;
      for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, gy + i * (h - gy) / 9); ctx.lineTo(w, gy + i * (h - gy) / 9); ctx.stroke(); }
      ctx.strokeStyle = '#cbab48'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 130; i++) { const x = rand(i) * w, yy = gy + 12 + rand(i * 2) * (h - gy - 24); const sw = Math.sin(t + i) * 2; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + sw, yy - 13); ctx.stroke(); }
      // 小屋（漸層+屋頂陰影）
      const hutX = w * 0.13;
      const hg = ctx.createLinearGradient(hutX, 0, hutX + 50, 0); hg.addColorStop(0, '#8a6a44'); hg.addColorStop(1, '#5f4528');
      ctx.fillStyle = hg; ctx.fillRect(hutX, gy - 36, 50, 36);
      ctx.fillStyle = '#4e3320'; ctx.beginPath(); ctx.moveTo(hutX - 8, gy - 36); ctx.lineTo(hutX + 25, gy - 56); ctx.lineTo(hutX + 58, gy - 36); ctx.closePath(); ctx.fill();
      drawFigure(ctx, w * 0.55, gy + 32, 1.12, stage.figure, t);
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
      if (zoom && zoom > 1.001) {
        ctx.translate(w * 0.5, h * 0.72); ctx.scale(zoom, zoom); ctx.translate(-w * 0.52, -h * 0.72);
      }
      (SCENES[stage.scene] || SCENES.savanna)(ctx, w, h, stage, t);
      ctx.restore();
      if (zoom && zoom > 1.8) drawSkullInset(ctx, w - 130, h - 130, stage);
    };
  }

  function drawSkullInset(ctx, x, y, stage) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,16,12,0.8)'; ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 64, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 64, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y + 44); ctx.scale(2.2, 2.2);
    drawHead(ctx, 0, 0, 22, { ...stage.figure }, stage.figure.fur > 0.55 ? '#7a5236' : '#a06a45', '#2c1d12', 1, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,220,160,0.9)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('腦容量 ' + stage.brainCc + ' cc', x, y + 52);
  }

  global.SceneRenderer = SceneRenderer;
  global.drawFigure = drawFigure;
})(window);
