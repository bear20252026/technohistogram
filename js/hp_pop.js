// Chart options: one button on the toolbar opens a popover holding the view's own controls.
// The controls keep their elements, bindings and hash state; only where they sit changes.
export function popover(btn, pop, { onToggle } = {}) {
  const open = (on) => {
    pop.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    if (on) { const f = pop.querySelector('button:not([hidden]), [tabindex="0"]'); if (f) f.focus({ preventScroll: true }); }
    onToggle && onToggle(on);
  };
  btn.addEventListener('click', () => open(pop.hidden));
  document.addEventListener('pointerdown', (ev) => { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) open(false); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !pop.hidden) { ev.preventDefault(); open(false); btn.focus(); } });
  return { open, isOpen: () => !pop.hidden };
}
