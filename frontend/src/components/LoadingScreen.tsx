import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingScreen.css';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
  /** Resolves when real first-paint assets are ready; the counter holds at 99% until then. */
  whenReady?: Promise<unknown>;
}

// Timing for the staged counter (ms).
const FAST_DURATION = 180;   // 0 -> 99, quick
const MIN_HOLD_99 = 40;      // the "kink": always pause at 99% at least this long
const MAX_HOLD_99 = 4000;    // hard cap so a slow/failed asset can never hang the loader
const FINISH_DURATION = 60;  // 99 -> 100
const HOLD_AT_100 = 0;       // reveal as soon as 100 is shown

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onLoadingComplete,
  whenReady
}) => {
  // Keep the overlay in place while it fades so underlying content is never
  // revealed from the footer upward during a cold-load handoff.
  const variants = {
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: {
      opacity: 0,
      transition: { duration: 0.14, ease: [0.4, 0, 0.2, 1] }
    }
  } as const;

  const [show, setShow] = useState(true);
  const counterRef = useRef<HTMLSpanElement>(null);
  const onEndRef = useRef(onLoadingComplete);
  const whenReadyRef = useRef(whenReady);
  onEndRef.current = onLoadingComplete;
  whenReadyRef.current = whenReady;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const setText = (v: number) => {
      if (counterRef.current) counterRef.current.textContent = String(v);
    };
    const sleep = (ms: number) => {
      const p = new Promise<void>((resolve) => {
        timeouts.push(setTimeout(resolve, ms));
      });
      return p;
    };

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Animate a value over `ms` with an ease-out curve, calling onFrame each tick.
    const animate = (from: number, to: number, ms: number, onFrame: (v: number) => void) =>
      new Promise<void>((resolve) => {
        let start: number | null = null;
        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
        const tick = (now: number) => {
          if (cancelled) return resolve();
          if (start === null) start = now;
          const p = Math.min(1, (now - start) / ms);
          onFrame(from + (to - from) * easeOut(p));
          if (p < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        raf = requestAnimationFrame(tick);
      });

    // The ready gate: never shorter than MIN_HOLD_99, never longer than MAX_HOLD_99.
    const readyGate = async () => {
      const ready = Promise.resolve(whenReadyRef.current).catch(() => undefined);
      await Promise.all([
        sleep(MIN_HOLD_99),
        Promise.race([ready, wait(MAX_HOLD_99)])
      ]);
    };

    const run = async () => {
      if (prefersReduced) {
        setText(99);
        await readyGate();
        if (cancelled) return;
        setText(100);
      } else {
        await animate(0, 99, FAST_DURATION, (v) => setText(Math.floor(v)));
        if (cancelled) return;
        setText(99);
        await readyGate();
        if (cancelled) return;
        await animate(99, 100, FINISH_DURATION, (v) => setText(Math.round(v)));
        if (cancelled) return;
        setText(100);
      }
      await sleep(HOLD_AT_100);
      if (cancelled) return;
      setShow(false);
    };

    run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="hk-opening"
          aria-label="Loading"
          variants={variants}
          initial="visible"
          animate="visible"
          exit="exit"
          onAnimationComplete={(def) => {
            if (def === 'exit') {
              onEndRef.current?.();
            }
          }}
        >
          <div className="hk-opening__center">
            <div className="hk-counter-wrapper">
              <span className="hk-counter" ref={counterRef}>0</span>
              <span className="hk-percent">%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
