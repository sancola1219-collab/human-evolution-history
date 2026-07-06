/* =============================================================================
 * data.js — 資料層（唯一真相來源 / Single Source of Truth）
 * -----------------------------------------------------------------------------
 * 整個「人類進化史」的內容都在這個陣列。要新增/修改一個演化階段，只改這裡，
 * scenes.js（畫面）與 app.js（流程）會自動吃這份資料。
 *
 * 每個 stage 物件欄位說明：
 *   id        : 唯一代號（英文、不重複，存檔與 URL 會用到，不要改已上線的 id）
 *   name      : 中文名
 *   latin     : 學名
 *   epoch     : 地質年代
 *   yearsAgo  : 距今大約幾「年」前（數字，用來排時間軸；present≈0）
 *   timeLabel : 給人看的時間標籤
 *   brainCc   : 腦容量（毫升，約略）
 *   heightCm  : 身高（公分，約略）
 *   habitat   : 棲地／氣候
 *   region    : 地理分布
 *   traits    : 關鍵特徵（陣列，短句）
 *   tools     : 工具／技術里程碑
 *   milestone : 這階段「人類第一次做到的事」（一句話，教學重點）
 *   diet      : 食性
 *   fact      : 冷知識（勾起興趣）
 *   palette   : 這個場景的主色（給 scenes.js 畫天空／地面用）
 *   figure    : 給 scenes.js 畫人物的參數（見下方 FIGURE 說明）
 *   scene     : scenes.js 用的場景代號（決定畫哪種環境）
 *
 * FIGURE 參數（讓觀眾「看見」演化：姿勢變直、腦變大、毛變少）：
 *   stoop     : 前傾彎腰角度 0=完全直立 … 1=四足傾向（弧度比例）
 *   brain     : 腦殼相對大小 0.4→1.0
 *   brow      : 眉脊突出 0→1
 *   fur       : 體毛覆蓋 0（無毛穿衣）→1（全身毛）
 *   height    : 相對身高 0.5→1.0
 *   tool      : 手持物 'none'|'stone'|'handaxe'|'spear'|'torch'|'brush'
 *   clothing  : 衣物 'none'|'hide'|'furwrap'|'tailored'
 * ========================================================================== */

const EVOLUTION_STAGES = [
  {
    id: 'sahelanthropus',
    name: '撒海爾人',
    latin: 'Sahelanthropus tchadensis',
    epoch: '中新世晚期',
    yearsAgo: 7000000,
    timeLabel: '約 700 萬年前',
    brainCc: 350,
    heightCm: 110,
    habitat: '湖畔森林與疏林交界',
    region: '中非（查德）',
    traits: ['最早可能的人族之一', '枕骨大孔偏前，暗示可能直立', '犬齒較小'],
    tools: '尚無石器',
    milestone: '從演化樹上，人與黑猩猩的路線大約在此分岔。',
    diet: '果實、嫩葉、堅果',
    fact: '只靠一顆被暱稱「圖邁（Toumaï）」的頭骨，就改寫了人類起源的時間表。',
    palette: { sky: ['#f6c98a', '#e08a4a', '#7a4a3a'], ground: '#4a3b28', accent: '#caa15a' },
    figure: { stoop: 0.72, brain: 0.42, brow: 0.55, fur: 1.0, height: 0.55, tool: 'none', clothing: 'none' },
    scene: 'lakeforest'
  },
  {
    id: 'ardipithecus',
    name: '地猿（阿爾迪）',
    latin: 'Ardipithecus ramidus',
    epoch: '上新世早期',
    yearsAgo: 4400000,
    timeLabel: '約 440 萬年前',
    brainCc: 350,
    heightCm: 120,
    habitat: '濕潤林地',
    region: '東非（衣索比亞）',
    traits: ['能直立行走也能爬樹', '腳拇趾仍可對握（抓樹枝）', '骨盆兼顧兩種移動'],
    tools: '尚無石器',
    milestone: '直立行走的「過渡型」：地上走、樹上爬兩邊都行。',
    diet: '雜食（果實、嫩葉、小動物）',
    fact: '化石「阿爾迪（Ardi）」比露西還老一百多萬年，推翻了「人類祖先像黑猩猩」的舊想像。',
    palette: { sky: ['#cfe3a8', '#8fb45e', '#4f6b34'], ground: '#3f5228', accent: '#b7c96a' },
    figure: { stoop: 0.55, brain: 0.44, brow: 0.5, fur: 0.95, height: 0.6, tool: 'none', clothing: 'none' },
    scene: 'woodland'
  },
  {
    id: 'australopithecus',
    name: '南方古猿（露西）',
    latin: 'Australopithecus afarensis',
    epoch: '上新世',
    yearsAgo: 3200000,
    timeLabel: '約 320 萬年前',
    brainCc: 420,
    heightCm: 110,
    habitat: '疏樹草原（莽原）',
    region: '東非（衣索比亞、坦尚尼亞）',
    traits: ['完全習慣直立行走', '仍保有適合爬樹的長手臂', '身材矮小、兩性差異大'],
    tools: '可能使用天然物件，尚無成形石器',
    milestone: '留下了雷托利（Laetoli）腳印——320 萬年前確鑿的直立行走證據。',
    diet: '果實、根莖、種子',
    fact: '「露西（Lucy）」的名字來自考古隊當晚一直播放的披頭四歌曲〈Lucy in the Sky with Diamonds〉。',
    palette: { sky: ['#ffd98a', '#f0a04a', '#b96a3a'], ground: '#8a7a3a', accent: '#d9b45a' },
    figure: { stoop: 0.3, brain: 0.5, brow: 0.45, fur: 0.85, height: 0.55, tool: 'none', clothing: 'none' },
    scene: 'savanna'
  },
  {
    id: 'habilis',
    name: '巧人',
    latin: 'Homo habilis',
    epoch: '更新世早期',
    yearsAgo: 2300000,
    timeLabel: '約 230 萬年前',
    brainCc: 610,
    heightCm: 120,
    habitat: '草原與河谷',
    region: '東非、南非',
    traits: ['腦容量明顯變大', '手部靈巧、能精準抓握', '仍會爬樹'],
    tools: '奧杜韋（Oldowan）石器：敲砸出鋒利石片',
    milestone: '第一個被歸入「人屬（Homo）」的物種——人類開始「製造工具」。',
    diet: '腐食、切割肉類、植物',
    fact: '「Habilis」拉丁文意為「靈巧的」，因為牠們是第一批被確認會刻意打製石器的人族。',
    palette: { sky: ['#f2c46a', '#d98a44', '#8a5a34'], ground: '#7a6a3a', accent: '#cda256' },
    figure: { stoop: 0.22, brain: 0.62, brow: 0.5, fur: 0.7, height: 0.6, tool: 'stone', clothing: 'none' },
    scene: 'savanna_tools'
  },
  {
    id: 'erectus',
    name: '直立人',
    latin: 'Homo erectus',
    epoch: '更新世',
    yearsAgo: 1900000,
    timeLabel: '約 190 萬年前',
    brainCc: 950,
    heightCm: 170,
    habitat: '草原、林地，適應多種氣候',
    region: '非洲 → 亞洲、歐洲（第一批走出非洲）',
    traits: ['身材接近現代人比例', '長距離奔跑與行走的高手', '群體協作'],
    tools: '阿舍利（Acheulean）手斧；掌握用火',
    milestone: '第一次「用火」與「走出非洲」——把人類版圖擴張到舊大陸。',
    diet: '狩獵與採集，開始吃熟食',
    fact: '學會控制火之後，熟食讓消化更省力，可能是腦容量能繼續變大的關鍵。',
    palette: { sky: ['#c98a4a', '#7a4a2a', '#2a1a14'], ground: '#3a2a1a', accent: '#ff9a3a' },
    figure: { stoop: 0.12, brain: 0.78, brow: 0.6, fur: 0.45, height: 0.85, tool: 'handaxe', clothing: 'hide' },
    scene: 'firecamp'
  },
  {
    id: 'heidelbergensis',
    name: '海德堡人',
    latin: 'Homo heidelbergensis',
    epoch: '更新世中期',
    yearsAgo: 700000,
    timeLabel: '約 70 萬年前',
    brainCc: 1250,
    heightCm: 175,
    habitat: '較冷的溫帶森林',
    region: '非洲、歐洲、西亞',
    traits: ['腦容量接近現代人', '體格強壯', '可能是尼安德塔人與智人的共同祖先'],
    tools: '木製長矛、合作狩獵大型獵物',
    milestone: '第一批用「木矛」主動獵殺大型動物、並可能搭建簡單庇護所。',
    diet: '大型獵物、採集',
    fact: '德國出土的舍寧根（Schöningen）木矛已有約 30 萬年，是保存最好的舊石器狩獵武器之一。',
    palette: { sky: ['#a8bcc9', '#6f8a99', '#3f5560'], ground: '#3a4a3a', accent: '#8aa06a' },
    figure: { stoop: 0.08, brain: 0.88, brow: 0.55, fur: 0.35, height: 0.9, tool: 'spear', clothing: 'hide' },
    scene: 'coldforest'
  },
  {
    id: 'neanderthal',
    name: '尼安德塔人',
    latin: 'Homo neanderthalensis',
    epoch: '更新世晚期（冰河期）',
    yearsAgo: 400000,
    timeLabel: '約 40 萬–4 萬年前',
    brainCc: 1450,
    heightCm: 165,
    habitat: '冰河期的歐洲與西亞',
    region: '歐洲、西亞',
    traits: ['腦容量甚至比現代人略大', '體格粗壯、耐寒', '會照顧傷患、埋葬死者'],
    tools: '莫斯特（Mousterian）石器、獸皮衣物、洞穴用火',
    milestone: '第一批有「喪葬與照護」行為的人類——出現了同理心的證據。',
    diet: '以狩獵大型動物為主（猛獁象、馴鹿）',
    fact: '現代非非洲人的 DNA 裡，約有 1–2% 來自尼安德塔人——牠們沒真正滅絕，而是融進了我們。',
    palette: { sky: ['#cdd9e2', '#9fb0bd', '#5f7080'], ground: '#c9d2d8', accent: '#e8f0f5' },
    figure: { stoop: 0.06, brain: 0.95, brow: 0.7, fur: 0.0, height: 0.82, tool: 'spear', clothing: 'furwrap' },
    scene: 'iceage'
  },
  {
    id: 'sapiens',
    name: '智人（現代人）',
    latin: 'Homo sapiens',
    epoch: '更新世晚期 → 全新世',
    yearsAgo: 300000,
    timeLabel: '約 30 萬年前至今',
    brainCc: 1350,
    heightCm: 170,
    habitat: '遍布全球所有氣候帶',
    region: '非洲起源 → 全世界',
    traits: ['額頭高、下巴明顯、眉脊消退', '複雜語言與抽象思考', '符號、藝術、宗教'],
    tools: '複合工具、投矛器、弓箭、洞穴壁畫',
    milestone: '第一個會「畫畫、說故事、想像不存在之物」的物種——文化開始加速演化。',
    diet: '狩獵採集 → 後來發展農業',
    fact: '法國拉斯科（Lascaux）洞穴壁畫約 1.7 萬年，證明我們的祖先早就會用藝術記錄世界。',
    palette: { sky: ['#3a2a3a', '#5a3a2a', '#1a1420'], ground: '#2a2020', accent: '#ffb95a' },
    figure: { stoop: 0.02, brain: 1.0, brow: 0.2, fur: 0.0, height: 0.92, tool: 'brush', clothing: 'tailored' },
    scene: 'caveart'
  },
  {
    id: 'civilization',
    name: '文明（農業之後）',
    latin: 'Homo sapiens sapiens',
    epoch: '全新世',
    yearsAgo: 12000,
    timeLabel: '約 1.2 萬年前至今',
    brainCc: 1350,
    heightCm: 170,
    habitat: '定居的村落與城市',
    region: '肥沃月彎 → 全球',
    traits: ['農業與畜牧', '定居、人口爆炸', '文字、金屬、國家'],
    tools: '農具、陶器、文字、金屬冶煉',
    milestone: '第一次「農業革命」——人不再追著食物跑，而是讓食物長在身邊。',
    diet: '栽培作物、馴養家畜',
    fact: '農業讓人口暴增，卻也帶來階級、疾病與更辛苦的勞動——是福是禍，至今仍有爭論。',
    palette: { sky: ['#8ec6e6', '#e6d29a', '#c9a86a'], ground: '#b89a5a', accent: '#e8c46a' },
    figure: { stoop: 0.0, brain: 1.0, brow: 0.18, fur: 0.0, height: 0.94, tool: 'none', clothing: 'tailored' },
    scene: 'farmland'
  }
];

/* 供 app.js 快速查詢：id -> stage */
const STAGE_BY_ID = Object.fromEntries(EVOLUTION_STAGES.map(s => [s.id, s]));

/* 時間軸範圍（給遠看模式算比例） */
const TIME_MIN = 0;              // 現在
const TIME_MAX = 7000000;        // 700 萬年前

/* 若在 Node 環境（驗證腳本）也能取用 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EVOLUTION_STAGES, STAGE_BY_ID, TIME_MIN, TIME_MAX };
}
