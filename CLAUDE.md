# CLAUDE.md — 人類進化史（Claude Code 自動載入）

> 這只是入口摘要。**細節唯一正解在 [`HANDOFF.md`](HANDOFF.md)，動手前先讀它。**
> 紅線若有變動，要同步改 `HANDOFF.md`、`AGENTS.md`、`CLAUDE.md` 三處。

## 這是什麼
純前端、零依賴的人類進化史互動教材。**遠看** 700 萬年時間軸、**近看**程序化寫實場景 + 教學面板。所有畫面用 Canvas 即時畫，**無外部圖檔**。

## 開工前必知（紅線＝發生過的真實事故）
1. **`data.js` 是唯一真相來源**——加內容/改文字 99% 只改這裡。改完必跑 `node tools/validate.js`（全綠才算數）。
2. **Canvas 是替換元素**：只設 `left/right:0` 不會被撐開，會縮成 300×150。用外層 div 撐開。（曾害時間軸整條消失）
3. **人物頭部只 translate 一次**：曾雙重位移害兩顆頭飛到畫面頂端。
4. **背景分頁 rAF 會暫停 → 自動截圖會逾時/空白**。驗畫面要用離屏 canvas 手動推幀 + 像素取樣，別以為壞了。
5. **每次改版 `index.html` 四個 `?v=N` 一起 +1**，否則使用者看到「改了沒變」。
6. **存檔結構改版 → `SAVEKEY` 版本號 +1**（目前 `humanEvolution.v1`）。
7. **拒絕照片貼圖**，美術一律向量重繪。

## 常用指令
```
node tools/server.js      # 本機預覽 http://localhost:8080
node tools/validate.js    # 資料層完整性檢查（改完 data.js 必跑）
```

## 部署
一 repo 一 GitHub Pages。`gh` 不在 PATH 需全路徑，帳號 sancola1219-collab。流程見 HANDOFF §8。

## 交接時
把新踩的雷寫進 `lessons/`（一檔一課、開頭一行摘要、記「怎麼做 + 為什麼重要」）。
