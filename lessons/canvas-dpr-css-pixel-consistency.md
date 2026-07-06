# context 設了 dpr transform 後，繪圖一律用 CSS 像素，別混用 buffer 尺寸

**症狀（潛在）**：`app.js` 的 `resize()` 對 canvas 做了 `setTransform(dpr,0,0,dpr,0,0)`（讓高解析度螢幕清晰）。但 `SceneRenderer.draw` 卻用 `canvas.width`（buffer 像素＝cssW×dpr）當繪圖寬高。在 dpr=1 的螢幕看起來正常，一旦使用者用 dpr=2 的高解析度／高 DPI 螢幕，場景會被畫成**兩倍大、只剩左上角**。

**原因**：context 已被 dpr 放大，座標系是「CSS 像素」。若又餵 buffer 尺寸（已含一次 dpr），等於再乘一次 dpr。這種 bug 在開發者自己 dpr=1 的機器上完全看不出來，換一台筆電就爆。

**正確做法（已採用）**：
- 在 `resize()` 把 CSS 尺寸存到 `canvas._cssW / _cssH`。
- 所有繪圖以 CSS 像素為準：
  ```js
  const w = canvas._cssW || canvas.width;   // 離屏測試 canvas 沒有 _cssW，退回 buffer 尺寸
  const h = canvas._cssH || canvas.height;
  ```
- 規則：**設了 `setTransform(dpr)` 的 context，之後所有座標都用 CSS 像素**；buffer 尺寸只在設定 `canvas.width/height` 與 `clearRect` 時碰。

**為什麼重要**：DPR 一致性是 Canvas 最隱形的陷阱之一——症狀依螢幕而異、開發機常測不到。訂下「畫圖只用 CSS 像素」這條規矩，就不會踩。離屏 canvas（驗證用）不設 transform，所以用 `|| canvas.width` 退回，兩邊都對。
