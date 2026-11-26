// Text helpers shared by the views: short titles for dense views, and word wrapping instead of clipping.
// Rule from the V2 critique: captions and key numbers never truncate; event titles in dense views use the
// build-time title_short; an ellipsis only ever marks an explicit "+ n more" affordance.

export const shortTitle = (e) => (e && (e.title_short || e.title)) || '';

// split into at most `max` lines of about `n` characters each, on word boundaries; the last line keeps the rest
export function wrapChars(s, n, max = 2) {
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (lines.length === max - 1) { cur = cur ? cur + ' ' + w : w; continue; }
    if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

// wrap by measured width (canvas 2d context) into at most `max` lines; the final line is clipped with an
// ellipsis only if it still does not fit, which the callers treat as a layout bug to size around
export function wrapMeasured(ctx, s, w, font, max = 2) {
  ctx.font = font;
  const words = String(s || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const t = cur ? cur + ' ' + word : word;
    if (ctx.measureText(t).width <= w || !cur) cur = t;
    else { lines.push(cur); cur = word; if (lines.length === max) break; }
  }
  if (lines.length < max && cur) lines.push(cur);
  else if (lines.length === max) {
    // rest of the words did not fit: fold them into the last line and clip
    const rest = words.slice(lines.join(' ').split(' ').length).join(' ');
    let last = lines[max - 1] + (rest ? ' ' + rest : '');
    while (last.length > 3 && ctx.measureText(last + '\u2026').width > w) last = last.slice(0, -1);
    lines[max - 1] = last.length < (lines[max - 1] + (rest ? ' ' + rest : '')).length ? last.trimEnd() + '\u2026' : last;
  }
  return lines;
}

// append tspans for lines to a d3 text selection; lh in px
export function tspans(textSel, lines, x, lh) {
  textSel.text(null);
  lines.forEach((l, i) => textSel.append('tspan').attr('x', x).attr('dy', i === 0 ? 0 : lh).text(l));
  return textSel;
}
