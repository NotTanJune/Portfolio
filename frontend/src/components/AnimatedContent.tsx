import React, { useRef, useLayoutEffect, PropsWithChildren } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface AnimatedContentProps {
  distance?: number; // px
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  duration?: number; // seconds
  ease?: gsap.TweenVars['ease'];
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  threshold?: number; // 0..1
  delay?: number; // seconds
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AnimatedContent: React.FC<PropsWithChildren<AnimatedContentProps>> = ({
  children,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  onComplete,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect user reduced motion preference
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Mobile adjustments: shorter distance and duration for snappier feel
    const isMobile = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
    const adjDistance = isMobile ? distance * 0.6 : distance;
    const adjDuration = prefersReduced ? 0 : isMobile ? Math.min(duration, 0.65) : duration;

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const offset = reverse ? -adjDistance : adjDistance;
    const startPct = (1 - Math.max(0, Math.min(1, threshold))) * 100; // 0..100

    if (prefersReduced) {
      // Instantly show (accessibility) and skip ScrollTrigger
      gsap.set(el, { clearProps: 'all', opacity: 1, scale: 1, x: 0, y: 0 });
      onComplete?.();
      return;
    }

    gsap.set(el, {
      [axis]: offset,
      scale,
      autoAlpha: animateOpacity ? initialOpacity : 1,
      force3D: true,
    });

    const tween = gsap.to(el, {
      [axis]: 0,
      scale: 1,
      autoAlpha: 1,
      duration: adjDuration,
      ease,
      delay,
  onStart: () => { gsap.set(el, { willChange: 'transform, opacity' }); },
      onComplete: () => {
        // Drop will-change to free memory/GPU after animation
        gsap.set(el, { clearProps: 'willChange' });
        onComplete?.();
      },
      scrollTrigger: {
        trigger: el,
        start: `top ${startPct}%`,
        toggleActions: 'play none none none',
        once: true,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        anticipatePin: 0.4,
      },
    });

    return () => {
      // Clean only triggers attached to this element
      ScrollTrigger.getAll().forEach((st) => {
        if (st.trigger === el) st.kill();
      });
      gsap.killTweensOf(el);
      if (tween) tween.kill();
    };
  }, [
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    onComplete,
  ]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

export default AnimatedContent;
