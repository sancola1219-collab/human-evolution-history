# Canvas 是「替換元素」，只設 left/right:0 不會被撐開

**症狀**：時間軸 `<canvas>` 用 `position:absolute; left:0; right:0; top:130px; bottom:40px` 卻縮成內在的 300×150；改成 `width:100%; height:auto` 後高度反而暴衝到 1280px（跟著繪圖緩衝的長寬比走），版面爆掉。

**原因**：`<canvas>` 是 **replaced element（替換元素）**。CSS 對替換元素的絕對定位規則跟一般 block 不同——`left:0;right:0` 不會把它拉寬，它會用「內在尺寸」（預設 300×150）；而 `height:auto` 會依繪圖緩衝的長寬比推算高度，緩衝一大就爆高。

**正確做法（已採用）**：
```html
<div class="timeline-wrap"><canvas id="timeline"></canvas></div>
```
```css
.timeline-wrap { position:absolute; left:0; right:0; top:130px; bottom:40px; } /* 一般 div 會被撐開 */
#timeline { display:block; width:100%; height:100%; }                          /* canvas 填滿父層 */
```
外層用一般 div（會被 left/right/top/bottom 撐開），canvas 設 `width:100%;height:100%` 填滿它。**絕不要對要自適應的 canvas 用 `height:auto`。**

**為什麼重要**：這個 bug 讓整條時間軸消失或版面炸開，而且症狀（0×0 或 1280 高）會誤導人往 JS resize 邏輯找，其實是 CSS 替換元素特性。踩過一次要記住，別再往 JS 那邊debug。
