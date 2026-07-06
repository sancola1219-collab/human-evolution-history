# 持續 rAF 動畫 + 背景分頁 → 自動截圖會逾時，要用離屏 canvas 手動推幀驗證

**症狀**：本專案主迴圈是不停的 `requestAnimationFrame`。用自動化預覽的 `screenshot` 一律**逾時 30 秒**或拍到全黑，讓人以為程式壞了。

**兩個原因**：
1. **背景/隱藏分頁的 `requestAnimationFrame` 會被瀏覽器暫停**（`document.visibilityState === 'hidden'`），所以畫布根本沒被畫 → 空白。
2. 分頁在前景時，持續 rAF 讓頁面永遠不「idle」，截圖工具等不到穩定幀 → 逾時。

**正確驗證法（已驗證可行）**：不要靠對真實畫布截圖，改用**離屏 canvas 手動推一幀**再檢查：
```js
const c = document.createElement('canvas'); c.width = 640; c.height = 400;
const R = new SceneRenderer(c);
R.draw(stage, 1.2, 1, {});                       // 手動畫一幀，不依賴 rAF
const d = c.getContext('2d').getImageData(0,0,640,400).data;
// 判準 A（有沒有畫）：非空像素多、顏色種類 > 3
// 判準 B（畫得對不對）：c.toDataURL('image/png') 存成檔案，用眼睛看一幀
```

**為什麼重要**：
- 「像素取樣」能快速確認「有沒有畫出東西」，但**看不出位置錯誤**（例如頭飄到頂）。位置類 bug 一定要**存 PNG 實際看**（見 [figure-head-double-translate](figure-head-double-translate.md)）。
- 若不知道這個特性，會浪費大量時間 debug 一個其實正常運作的畫面。看到截圖逾時/空白，先想「是不是 rAF 被暫停」，而不是先改程式。
