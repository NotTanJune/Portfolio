// Detects mid-word line breaks in a container and prevents them by wrapping
// the broken word in a <span style="white-space: nowrap">...</span>.
import { useEffect } from 'react';

function fixOneSplit(root: HTMLElement): boolean {
  // Text nodes only
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.nodeValue || '';
    if (!text.trim()) continue;

    // Iterate words in this text node
    const re = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;

      // Skip if already inside a nowrap span
      if (node.parentElement?.closest('[data-nws="1"]')) continue;

      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);

      const rects = range.getClientRects();
      // If the word renders on more than one line, wrap it to keep it together
      if (rects.length > 1) {
        const before = text.slice(0, start);
        const word = text.slice(start, end);
        const after = text.slice(end);

        const span = document.createElement('span');
        span.textContent = word;
        span.style.whiteSpace = 'nowrap';
        span.style.display = 'inline';
        span.setAttribute('data-nws', '1');

        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        if (after) frag.appendChild(document.createTextNode(after));

        node.parentNode?.replaceChild(frag, node);
        return true; // changed DOM; let caller rerun
      }
    }
  }
  return false;
}

export function useNoWordSplit<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  targetSelector?: string
) {
  useEffect(() => {
    // Capture the element at the time the effect runs so callbacks don't
    // access a possibly-null ref after unmount or route changes.
    const el = containerRef.current;
    if (!el) return;

    const run = () => {
      const roots: HTMLElement[] = [];
      if (!el || !el.isConnected) return;
      if (targetSelector) {
        el.querySelectorAll<HTMLElement>(targetSelector).forEach((r) => roots.push(r));
      } else {
        roots.push(el);
      }

      for (const root of roots) {
        // Keep applying until no more splits found
        let changed = true;
        let guard = 0; // safety to avoid infinite loops
        while (changed && guard++ < 200) {
          changed = fixOneSplit(root);
        }
      }
    };

    // Initial pass after layout
    const id = requestAnimationFrame(run);

    // Re-run on resize
    const onResize = () => run();
    window.addEventListener('resize', onResize);

    // Re-run when container resizes
    const ro = new ResizeObserver(() => run());
    try {
      if (el.isConnected) ro.observe(el);
    } catch {
      // Element might be disconnected; ignore.
    }

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [containerRef, targetSelector]);
}