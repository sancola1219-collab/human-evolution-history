# 畫圓柱肢體用「圓頭粗線+描邊」，別用 arc() 手拼封口路徑

**症狀**：想畫有體積的四肢，用「兩條邊 + 兩端 `arc()` 圓帽」拼一個封閉 path 再填漸層，結果每個關節（膝、肘、髖、手）都冒出**白色實心圓圈**，人物像壞掉的機器人。

**原因**：`ctx.arc(cx, cy, r, startAngle, endAngle, ccw)` 的起訖角度與掃向（順/逆時針）很難跟前面 `lineTo` 的邊接得剛好。角度算錯會讓圓帽掃了反向的一大段，path 自我交疊；再加上填的是「橫跨法線的線性漸層」，端點區域的漸層座標被 clamp 到最亮的色停（趨白），就把整個圓帽填成亮白圓。

**正確做法（已採用）**：不要手拼 path，改用**圓頭粗線**當肢體主體，再疊兩條偏移的描邊做明暗：
```js
ctx.lineCap = 'round';
ctx.strokeStyle = base;              ctx.lineWidth = diameter;      // 主體（圓頭自帶關節球）
ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
// 暗面：往背光側偏移、低透明、細
// 亮面：往受光側偏移、更細
```
圓頭 `lineCap` 自動給出關節的圓球感，完全不需要自己算 arc 角度。明暗描邊用 `globalAlpha` 柔化，避免硬黑縫讓肢體看起來分節像木偶。

**為什麼重要**：Canvas 手拼含 arc 的封閉路徑是「看起來簡單、實際很多角度陷阱」的經典來源。畫管狀物（肢體、樹枝、繩）優先想「粗線 + round cap」，通常又短又穩。這種「有畫但形狀怪」的 bug 像素取樣測不出來，一定要 [存 PNG 實際看](figure-head-double-translate.md)。
