import { useEffect, useMemo, useRef } from 'react';
import Lenis from 'lenis';

export type UseLenisOptions = {
  // Duration of scroll animation (seconds)
  // Custom easing
  // Multiplier for wheel scroll
  wheelMultiplier?: number;
  // Apply smoothing to wheel input (helps hide notches)
  smoothWheel?: boolean;
  // Multiplier for touch/trackpad input
  touchMultiplier?: number;
  // Sync touch for momentum
  syncTouch?: boolean;
  // Optional linear interpolation factor instead of duration mode
  lerp?: number;
  gestureOrientation?: string;
};

/**
 * Initializes Lenis smooth scrolling once and tears it down on unmount.
 * Respects prefers-reduced-motion and skips initialization if reduce is set.
 */
export function useLenis(options?: UseLenisOptions) {
  const lenisRef = useRef<Lenis | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const anchorsRef = useRef<HTMLAnchorElement[] | null>(null);

  // Create a stable key so we can re-init Lenis when options change
  const optionsKey = useMemo(() => {
    const o = {
      lerp: options?.lerp ?? undefined,
      smoothWheel: options?.smoothWheel ?? true,
      gestureOrientation: options?.gestureOrientation ?? 'vertical',
      wheelMultiplier: options?.wheelMultiplier ?? 0.6,
      touchMultiplier: options?.touchMultiplier ?? 1,
      syncTouch: options?.syncTouch ?? true,
    };
    return JSON.stringify(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.lerp, options?.smoothWheel, options?.gestureOrientation, options?.wheelMultiplier, options?.touchMultiplier, options?.syncTouch]);

  useEffect(() => {
    try {
      // Respect user preferences
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        return;
      }

      // Clean up any previous instance before initializing a new one
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (anchorsRef.current) {
        anchorsRef.current.forEach((a) => a.removeEventListener('click', handleAnchorClick as EventListener));
        anchorsRef.current = null;
      }
      if (lenisRef.current) {
        try { lenisRef.current.destroy(); } catch {}
        lenisRef.current = null;
      }

      // Initialize with the latest options
      const opts = JSON.parse(optionsKey);
      const lenis = new Lenis({
        lerp: opts.lerp,
        smoothWheel: opts.smoothWheel,
        gestureOrientation: opts.gestureOrientation,
        wheelMultiplier: opts.wheelMultiplier,
        touchMultiplier: opts.touchMultiplier,
        syncTouch: opts.syncTouch,
      } as any);
      lenisRef.current = lenis;

      const raf = (time: number) => {
        // lenis could be destroyed during hot reload; guard calls
        if (lenisRef.current) {
          lenisRef.current.raf(time);
          rafIdRef.current = requestAnimationFrame(raf);
        }
      };
      rafIdRef.current = requestAnimationFrame(raf);

      // Optional: smooth scroll for in-page anchor links
      const handleAnchorClick = (e: Event) => {
        const target = e.currentTarget as HTMLAnchorElement;
        const href = target.getAttribute('href') || '';
        if (href && href.startsWith('#') && href.length > 1) {
          e.preventDefault();
          lenis.scrollTo(href);
        }
      };

      const anchors = Array.from(document.querySelectorAll('a[href^="#"]')) as HTMLAnchorElement[];
      anchors.forEach((a) => a.addEventListener('click', handleAnchorClick));
      anchorsRef.current = anchors;

      return () => {
        if (anchorsRef.current) {
          anchorsRef.current.forEach((a) => a.removeEventListener('click', handleAnchorClick));
          anchorsRef.current = null;
        }
        if (rafIdRef.current != null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (lenisRef.current) {
          try { lenisRef.current.destroy(); } catch {}
          lenisRef.current = null;
        }
      };
    } catch (err) {
      // Fail silently if something unexpected happens; site continues to work without smooth scroll
      console.warn('Lenis initialization failed:', err);
    }
  }, [optionsKey]);

  return lenisRef;
}
