# AGENTS.md — 人類進化史（Codex / 其他 agent 自動載入）

> 入口摘要。**細節唯一正解在 [`HANDOFF.md`](HANDOFF.md)，動手前先讀它。**
> 紅線變動要同步 `HANDOFF.md`、`CLAUDE.md`、`AGENTS.md` 三處。

## 專案性質
純前端、零依賴（vanilla JS + Canvas）的人類進化史互動教材。**遠看**時間軸、**近看**寫實場景。無任何外部圖檔、無 build step、無 npm 依賴——直接用瀏覽器開 `index.html` 或 `node tools/server.js`。

## 架構（30 秒版）
- `data.js` → **資料層（唯一真相來源）**，9 個演化階段的資料 + 人物參數 + 場景代號。
- `scenes.js` → 美術層，`SCENES[代號]` 把場景畫出來；`drawFigure` 畫「會演化的身體」。
- `app.js` → 狀態機，overview↔scene、時間軸互動、縮放、存檔。
- `index.html` / `styles.css` → 骨架與樣式，含 `?v=N` 快取號。
- `tools/validate.js` → 改完 data.js 必跑的檢查。

## 動手守則（紅線＝真實事故）
1. 加內容只改 `data.js`；`scene` 代號必須對應 `scenes.js` 的 `SCENES` key，否則畫面空白。
2. 改完 `data.js` 跑 `node tools/validate.js`，exit 0 才算過。
3. Canvas 是替換元素，靠外層 div 撐開尺寸，別用 `height:auto`。
4. 人物頭部只位移一次（曾雙重 translate 出包）。
5. 驗畫面：背景分頁 rAF 停、截圖會逾時 → 用離屏 canvas 手動推幀 + 像素取樣。
6. 每次改版 `index.html` 的 `?v=N`（四個）一起 +1。
7. 存檔結構改版就把 `SAVEKEY` 版本號 +1。
8. 美術一律向量重繪，不貼照片。

## 驗證與交接
- 宣稱「完成」前：validate 全綠 + 本機手動點過一輪 + 像素取樣確認有畫面。
- 踩到新雷寫進 `lessons/`（一檔一課、開頭一行摘要、記做法與為什麼重要）。
