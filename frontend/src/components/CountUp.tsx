import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const target = direction === 'down' ? from : to; // where we want to end visually
  const startValue = direction === 'down' ? to : from;
  const motionValue = useMotionValue(startValue);
  const lastDisplayedRef = useRef<number>(startValue);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
    // help the spring consider itself "at rest" near the target
    restDelta: 0.001,
    restSpeed: 0.001
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = String(startValue);
    }
    lastDisplayedRef.current = startValue;
  }, [startValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') {
        onStart();
      }

      const timeoutId = setTimeout(() => {
        motionValue.set(target);
      }, delay * 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, target, delay, onStart]);

  useEffect(() => {
    const endedRef = { current: false };
    const unsubscribe = springValue.on('change', latest => {
      if (!ref.current) return;

      const hasDecimals = maxDecimals > 0;
      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      // Monotonic display to avoid flicker near thresholds
      let displayValue = latest;
      if (!hasDecimals) {
        const rounded = Math.round(latest);
        if (direction === 'up') {
          displayValue = Math.max(lastDisplayedRef.current, Math.min(target, rounded));
        } else {
          displayValue = Math.min(lastDisplayedRef.current, Math.max(target, rounded));
        }
      }

      const formattedNumber = Intl.NumberFormat('en-US', options).format(displayValue);
      ref.current.textContent = separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
      lastDisplayedRef.current = Number(displayValue);

      // If we're close enough to target, snap and signal end once
      const epsilon = Math.max(0.5, 1 / Math.pow(10, Math.max(0, maxDecimals)));
      if (!endedRef.current && Math.abs(latest - target) <= epsilon) {
        endedRef.current = true;
        // Snap to exact target for a crisp 100
        motionValue.set(target);
        lastDisplayedRef.current = target;
        const finalText = Intl.NumberFormat('en-US', options).format(target);
        ref.current.textContent = separator ? finalText.replace(/,/g, separator) : finalText;
        if (typeof onEnd === 'function') onEnd();
      }
    });

    return () => unsubscribe();
  }, [springValue, separator, maxDecimals, motionValue, target, onEnd, direction]);

  return <span className={className} ref={ref} />;
}
