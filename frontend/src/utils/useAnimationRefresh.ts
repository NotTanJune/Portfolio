import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Centralized ScrollTrigger refresh orchestration to mitigate layout shifts on mobile
 * and after late-loading assets (fonts/images) or viewport chrome changes.
 */
export function useAnimationRefresh(deps: any[] = []) {
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const safeRefresh = () => {
      // Defer to next frame for smoother batching
      requestAnimationFrame(() => {
        try {
          ScrollTrigger.refresh();
        } catch (e) {
          // swallow errors if plugin not yet registered
        }
      });
    };

    const onLoad = () => safeRefresh();
    const onOrientation = () => {
      // allow address bar / viewport to settle
      setTimeout(safeRefresh, 140);
    };
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(safeRefresh, 140);
    };

    window.addEventListener('load', onLoad);
    window.addEventListener('orientationchange', onOrientation);
    window.addEventListener('resize', onResize);

    // Font loading (if supported)
    if ((document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => safeRefresh());
    } else {
      // fallback small delay
      setTimeout(safeRefresh, 400);
    }

    return () => {
      window.removeEventListener('load', onLoad);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('resize', onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
