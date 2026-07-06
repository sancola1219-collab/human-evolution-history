# HANDOFF — 人類進化史 互動教學模擬（交接唯一正解）

> 這份是**細節的唯一正解**。`CLAUDE.md` 與 `AGENTS.md` 只是入口摘要，改紅線要三檔同步。
> 接手的模型（Codex / Claude Code / 其他）**開工前先讀完這份**，再動手。

---

## 0. 一句話

一個純前端、零依賴的「人類進化史」互動教材：**遠看**一條 700 萬年時間軸、**近看**每個演化階段的程序化寫實場景，附教學面板。全部用 Canvas 即時畫，**沒有任何外部圖檔**。

線上：GitHub Pages（見 §部署）。本機：`node tools/server.js` → http://localhost:8080

---

## 1. 檔案地圖（每個檔案負責什麼）

| 檔案 | 角色 | 改東西時看這裡 |
|---|---|---|
| `data.js` | **資料層＝唯一真相來源** | 新增/修改演化階段、文字、數據、場景代號、人物參數 |
| `scenes.js` | 美術層（程序化向量繪圖） | 場景長相、人物畫法、新增 `scene` 代號的畫法 |
| `app.js` | 流程層（狀態機） | 遠看↔近看切換、時間軸互動、縮放、鍵盤、存檔 |
| `index.html` | 骨架 + `?v=N` 快取號 | 加 DOM、改載入順序、**每次改版把 `?v=N` +1** |
| `styles.css` | UI 樣式 | 版面、顏色、RWD |
| `tools/server.js` | 本機靜態伺服器（零依賴） | 本機預覽 |
| `tools/validate.js` | 資料層完整性檢查 | **改完 data.js 一定要跑** |
| `lessons/` | 開發筆記（一檔一課） | 踩到雷、驗證過的做法就寫一則 |

**資料流**：`data.js`（資料）→ `app.js`（決定畫哪個階段、目前模式）→ `scenes.js`（把該階段畫出來）。
要加內容 99% 只改 `data.js`；只有「新的場景類型」才需要動 `scenes.js`。

---

## 2. 資料模型（data.js 的一個 stage 物件）

欄位定義寫在 `data.js` 檔頭註解，**以那份為準**。重點：

- `id`：唯一、英文、**一旦上線就不要改**（存檔 key 與未來 URL 會用到）。
- `yearsAgo`：距今年數（數字）。陣列**必須由古到今遞減排列**（validate 會擋亂序）。
- `figure`：人物演化參數 `{stoop, brain, brow, fur, height, tool, clothing}`——
  這是本教材的靈魂：切換階段時觀眾會**親眼看到**彎腰變直立、腦殼變大、體毛消失。改這些數字就能調人物。
- `scene`：場景代號，**必須**對應到 `scenes.js` 裡 `SCENES` 物件的一個 key，否則畫面空白（validate 會擋）。

新增一個階段的最小步驟：
1. 在 `EVOLUTION_STAGES` 插入物件（放在時間正確的位置，保持遞減）。
2. `scene` 用現有代號，或到 `scenes.js` 的 `SCENES` 加一個新畫法。
3. `node tools/validate.js` 必須全綠。
4. `index.html` 的 `?v=N` 全部 +1。

---

## 3. 座標系統（改 scenes.js 前必讀，這裡最容易踩雷）

- **人物 `drawFigure(ctx,x,y,s,fig,t)`**：`(x,y)` 是**腳底**位置，往上是負 y。全身高 `H`，頭在約 `-H`，臀在 `-0.5H`。
  - ⚠️ 地雷（已修）：頭部曾經被 `translate` 兩次導致飛到畫面頂端。**畫頭只 translate 一次到 (肩x, headY)**。見 `lessons/figure-head-double-translate.md`。
- **場景函式 `SCENES.xxx(ctx,w,h,stage,t)`**：`(w,h)` 是 CSS 像素尺寸；地平線通常取 `h*0.7` 左右。`t` 是動畫秒數（火焰、草擺動用）。
- **Canvas 是「替換元素」**：⚠️ 地雷（已修）——canvas 只寫 `position:absolute; left:0;right:0` **不會被撐開**，會縮成內在 300×150。必須用外層 div 撐開、canvas 設 `width:100%;height:100%`。見 `lessons/canvas-replaced-element-sizing.md`。
- **DPR**：`app.js` 的 `resize()` 依 devicePixelRatio 設緩衝並 `setTransform`，繪圖一律用 CSS 像素座標，不用自己乘 DPR。

---

## 4. 執行流程（app.js 狀態機）

```
overview（遠看）  ──點階段/Enter──►  scene（近看）
      ▲                                  │
      └────── 返回鈕 / Esc ──────────────┘
```
- 主迴圈 `requestAnimationFrame`：overview 畫時間軸，scene 畫場景。
- 近看導航：`←/→` 或箭頭鈕切換階段；縮放滑桿 `zoom` 1→3 放大看解剖（>1.8 出現頭骨特寫）。
- `window.__evo`（除錯用）：`.mode / .current / .zoom / .enterScene(i) / .exitScene() / .go(±1) / .stages`。

---

## 5. 存檔

- `localStorage` key = `humanEvolution.v1`（常數 `SAVEKEY` 在 `app.js`）。
- 目前只存「看過哪些階段 id」`{visited:[...]}`。
- ⚠️ 紅線：**存檔結構一改版，`SAVEKEY` 的版本號就要 +1**（v1→v2），否則舊存檔會餵壞新程式。載入端已 try/catch 容錯，但改結構仍要升 key。

---

## 6. 快取號（每次改版必做）

`index.html` 內所有 `?v=N`（styles/data/scenes/app）**每次改版一起 +1**。
為什麼重要：GitHub Pages / 瀏覽器會快取舊檔，不升號使用者會看到「改了卻沒變」的假象。

---

## 7. 測試與驗證（宣稱「好了」之前一定跑）

1. **資料層**：`node tools/validate.js` → 必須 exit 0、全綠。
2. **本機開起來**：`node tools/server.js` → 開 http://localhost:8080 手動點過一輪。
3. **畫面驗證（重要陷阱）**：本專案是**持續 rAF 動畫**，且**背景分頁 rAF 會暫停**——
   - 自動截圖工具常會**逾時**或拍到空白，這是預期，不是壞掉。
   - 正確做法：用離屏 canvas 手動推一幀再驗證：
     ```js
     const c=document.createElement('canvas'); c.width=640;c.height=400;
     const R=new SceneRenderer(c);
     R.draw(stage,1.2,1,{});                    // 手動畫一幀
     c.getContext('2d').getImageData(...)       // 取樣像素 or c.toDataURL() 存 PNG 檢視
     ```
   - 判準：非空像素多、顏色種類 > 3 → 有正常畫出東西。見 `lessons/testing-headless-canvas.md`。

---

## 8. 部署（GitHub Pages）

一遊戲一 repo 一 Pages（凱凱的統一模式）。
```
git init && git add -A && git commit -m "..."
gh repo create 人類進化史 --public --source=. --push   # gh 路徑見下
# GitHub → Settings → Pages → Deploy from branch: main / root
```
- `gh` 不在 PATH，需用全路徑（帳號 sancola1219-collab）。實際路徑見使用者記憶 `env-github-cli`。
- 部署後每次改版：`git add -A && commit && push`，並記得 §6 快取號 +1。

---

## 9. 地雷清單（發生過的真實事故，別重蹈）

| 事故 | 症狀 | 對策 |
|---|---|---|
| Canvas 替換元素不被撐開 | 時間軸縮成 300×150 或高度暴衝到 1280 | 外層 div 撐開，canvas `width/height:100%`；**別用 `height:auto`** |
| 人物頭部雙重 translate | 兩顆頭飄在畫面頂端 | 畫頭只位移一次到 (肩x, headY) |
| 背景分頁 rAF 暫停 | 自動截圖逾時/空白 | 離屏 canvas 手動推幀 + 像素取樣驗證 |
| 忘了升 `?v=N` | 改了上線卻沒變 | 每次改版四個 `?v=N` 一起 +1 |

---

## 10. 待辦 / 可擴充方向（給接手者的靈感）

- [ ] 加入「遷徙地圖」小視窗（走出非洲的路線動畫）。
- [ ] 每階段加語音旁白或計時自動導覽（教學模式）。
- [ ] 人物美術升級：分出兩條腿、加陰影落地、毛髮改用柔和 noise 而非放射線。
- [ ] i18n：把 `data.js` 文字抽成多語系。
- [ ] 測驗模式：看場景猜是哪個物種。

擴充時：**先讀本檔 → 改 data.js 為主 → 跑 validate → 手動驗畫面 → 升快取號 → 把新踩的雷寫進 `lessons/`**。
