import { RefObject, useEffect } from 'react';

const selector = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]';

export function useDpad(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const keydown = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
      const current = document.activeElement as HTMLElement;
      // Preserve cursor movement inside text fields.
      if (current?.matches('input, textarea, [contenteditable=true]') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const scope = container.querySelector('dialog[open]') || container;
      const candidates = Array.from(scope.querySelectorAll<HTMLElement>(selector)).filter(el => {
        const style = getComputedStyle(el);
        return !el.closest('[inert], [hidden]') && el.getClientRects().length > 0 && style.visibility !== 'hidden';
      });
      if (!candidates.length) return;
      event.preventDefault();
      if (!candidates.includes(current)) {
        candidates[0].focus();
        return;
      }
      const rect = current.getBoundingClientRect();
      const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
      const sign = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
      let best: HTMLElement | undefined, score = Infinity;
      for (const el of candidates) {
        if (el === current) continue;
        const r = el.getBoundingClientRect();
        const dx = r.x + r.width / 2 - cx, dy = r.y + r.height / 2 - cy;
        const forward = (vertical ? dy : dx) * sign;
        if (forward < 1) continue;
        const cross = Math.abs(vertical ? dx : dy);
        const next = forward + cross * 3;
        if (next < score) { best = el; score = next; }
      }
      best?.focus({ preventScroll: true });
      best?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };
    container.addEventListener('keydown', keydown);
    return () => container.removeEventListener('keydown', keydown);
  }, [root]);
}
