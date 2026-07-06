/* tools/validate.js — 資料層完整性檢查（零依賴）
 * 用法：node tools/validate.js
 * 為什麼重要：data.js 是唯一真相來源，接手的模型改資料後跑這支，
 * 就能在上線前抓出「缺欄位、id 重複、時間亂序、scene 代號沒對應畫法」等錯誤。
 * 退出碼 0=全過，1=有錯（可接進 CI）。 */
const path = require('path');
const fs = require('fs');
const { EVOLUTION_STAGES } = require(path.join(__dirname, '..', 'data.js'));

// 從 scenes.js 抓出有定義的 scene 代號（用正則，避免真的載入瀏覽器程式）
const scenesSrc = fs.readFileSync(path.join(__dirname, '..', 'scenes.js'), 'utf8');
const sceneBlock = scenesSrc.slice(scenesSrc.indexOf('const SCENES ='));
// 只抓「方法定義」：完整簽名 (ctx, w, h, stage, t) 後面接 {；呼叫點不會有 {，故不會誤抓
const definedScenes = new Set([...sceneBlock.matchAll(/(\w+)\s*\(ctx,\s*w,\s*h,\s*stage,\s*t\)\s*\{/g)].map(m => m[1]));

const REQUIRED = ['id','name','latin','epoch','yearsAgo','timeLabel','brainCc','heightCm',
  'habitat','region','traits','tools','milestone','diet','fact','palette','figure','scene'];
const FIG_REQ = ['stoop','brain','brow','fur','height','tool','clothing'];

let errors = 0;
const err = (m) => { console.error('  ✗ ' + m); errors++; };
const ids = new Set();
let lastYears = Infinity;

EVOLUTION_STAGES.forEach((s, i) => {
  const tag = `[${i}] ${s.id || '(無id)'}`;
  REQUIRED.forEach(k => { if (s[k] === undefined) err(`${tag} 缺欄位 ${k}`); });
  if (ids.has(s.id)) err(`${tag} id 重複`); ids.add(s.id);
  if (!Array.isArray(s.traits) || !s.traits.length) err(`${tag} traits 應為非空陣列`);
  if (s.palette && (!Array.isArray(s.palette.sky) || s.palette.sky.length !== 3)) err(`${tag} palette.sky 需 3 色`);
  if (s.figure) FIG_REQ.forEach(k => { if (s.figure[k] === undefined) err(`${tag} figure 缺 ${k}`); });
  if (s.scene && !definedScenes.has(s.scene)) err(`${tag} scene "${s.scene}" 在 scenes.js 沒有對應畫法`);
  if (typeof s.yearsAgo === 'number') {
    if (s.yearsAgo > lastYears) err(`${tag} 時間亂序（應由古到今遞減）`);
    lastYears = s.yearsAgo;
  }
});

console.log(`\n檢查 ${EVOLUTION_STAGES.length} 個演化階段，已定義場景：${[...definedScenes].join(', ')}`);
if (errors === 0) { console.log('✓ 資料層全部通過\n'); process.exit(0); }
else { console.error(`\n✗ 共 ${errors} 個錯誤\n`); process.exit(1); }
