import React, { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
  children: React.ReactNode;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  /** Seconds between each word's reveal. Lower = snappier. */
  stagger?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
  /** Element to render. Defaults to `h2`; use `p` when the text is body copy, not a heading. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div';
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  scrollContainerRef,
  enableBlur = false,
  baseOpacity = 0.15,
  baseRotation = 3,
  blurStrength = 4,
  stagger = 0.02,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'top center',
  wordAnimationEnd = 'top center',
  style,
  textStyle,
  as: Tag = 'h2'
}) => {
  const containerRef = useRef<HTMLElement>(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split(/(\s+)/).map((word, index) => {
      if (word.match(/^\s+$/)) return word;
      return (
        <span className="word" key={index}>
          {word}
        </span>
      );
    });
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scroller =
      scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;
    const wordElements = el.querySelectorAll<HTMLElement>('.word');

    // Reduced motion: show everything immediately, no scroll-linked animation.
    if (prefersReduced) {
      gsap.set(el, { rotate: 0 });
      gsap.set(wordElements, { opacity: 1, filter: 'blur(0px)' });
      return;
    }

    const triggers: ScrollTrigger[] = [];

    if (baseRotation !== 0) {
      const rotateTween = gsap.fromTo(
        el,
        { transformOrigin: '0% 50%', rotate: baseRotation },
        {
          ease: 'none',
          rotate: 0,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom-=10%',
            end: rotationEnd,
            scrub: true
          }
        }
      );
      if (rotateTween.scrollTrigger) triggers.push(rotateTween.scrollTrigger);
    }

    const opacityTween = gsap.fromTo(
      wordElements,
      { opacity: baseOpacity, willChange: 'opacity' },
      {
        ease: 'none',
        opacity: 1,
        stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: 'top bottom-=15%',
          end: wordAnimationEnd,
          scrub: true
        }
      }
    );
    if (opacityTween.scrollTrigger) triggers.push(opacityTween.scrollTrigger);

    if (enableBlur) {
      const blurTween = gsap.fromTo(
        wordElements,
        { filter: `blur(${blurStrength}px)` },
        {
          ease: 'none',
          filter: 'blur(0px)',
          stagger,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: 'top bottom-=15%',
            end: wordAnimationEnd,
            scrub: true
          }
        }
      );
      if (blurTween.scrollTrigger) triggers.push(blurTween.scrollTrigger);
    }

    return () => {
      triggers.forEach(t => t.kill());
    };
  }, [
    scrollContainerRef,
    enableBlur,
    baseRotation,
    baseOpacity,
    rotationEnd,
    wordAnimationEnd,
    blurStrength,
    stagger
  ]);

  return (
    <Tag
      ref={containerRef as React.Ref<any>}
      className={`scroll-reveal ${containerClassName}`}
      style={style}
    >
      <span className={`scroll-reveal-text ${textClassName}`} style={textStyle}>
        {splitText}
      </span>
    </Tag>
  );
};

export default ScrollReveal;
