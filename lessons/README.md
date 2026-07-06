# lessons/ — 開發筆記（一檔一課）

規範（凱凱指定）：
1. 每份筆記記**一件事**（一檔一課），檔名用 kebab-case。
2. 開頭第一行是**一行摘要**。
3. 「修正」（改錯的做法）與「確認」（驗證過可行的做法）都要記，並附上**為什麼重要**。
4. 已在 repo / HANDOFF / 對話紀錄的事**不要重複**。
5. 優先**更新既有筆記**，不要另開重複檔。
6. 發現內容**錯誤的筆記直接刪除**。

現有筆記：
- [canvas-replaced-element-sizing](canvas-replaced-element-sizing.md) — canvas 是替換元素，靠外層 div 撐開，別用 height:auto
- [figure-head-double-translate](figure-head-double-translate.md) — 相對座標別重複 translate，位置類 bug 要看 PNG
- [testing-headless-canvas](testing-headless-canvas.md) — 持續 rAF + 背景分頁會讓截圖失效，改用離屏 canvas 手動推幀
