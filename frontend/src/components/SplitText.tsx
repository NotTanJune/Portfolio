import React, { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number; // ms between elements
  duration?: number; // seconds
  ease?: gsap.TweenVars['ease'];
  splitType?: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number; // intersection threshold 0..1
  rootMargin?: string; // like CSS margin
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span';
  textAlign?: React.CSSProperties['textAlign'];
  style?: React.CSSProperties;
  onLetterAnimationComplete?: () => void;
}

const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = '',
  delay = 60,
  duration = 0.6,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.2,
  rootMargin = '0px',
  tag = 'p',
  textAlign = 'inherit',
  style,
  onLetterAnimationComplete
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // wait for fonts for accurate measurements/flow
    if ((document as any).fonts?.status === 'loaded') {
      setFontsLoaded(true);
    } else if ((document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => setFontsLoaded(true));
    } else {
      // fallback if Font Loading API unavailable
      const t = setTimeout(() => setFontsLoaded(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const parts = useMemo(() => {
    if (splitType === 'words' || splitType === 'lines') {
      // Keep spaces as their own spans for layout fidelity
      const tokens: { text: string; isSpace: boolean }[] = [];
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === ' ') {
          tokens.push({ text: ch, isSpace: true });
        } else {
          // accumulate consecutive non-spaces
          let j = i;
          let word = '';
          while (j < text.length && text[j] !== ' ') { word += text[j]; j++; }
          tokens.push({ text: word, isSpace: false });
          i = j - 1;
        }
      }
      return { tokens, isWords: true } as const;
    }
    // default: chars
    return { tokens: text.split('').map(ch => ({ text: ch, isSpace: ch === ' ' })), isWords: false } as const;
  }, [text, splitType]);

  useGSAP(
    () => {
      if (!ref.current || !fontsLoaded) return;
      const el = ref.current as HTMLElement;

      // Build targets
      const targets = gsap.utils.toArray<HTMLElement>(el.querySelectorAll('.split-unit'));

      // Compute ScrollTrigger start from threshold + rootMargin similar to the reference
      const startPct = (1 - Math.max(0, Math.min(1, threshold))) * 100; // 0..100
      const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0;
      const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px';
      const sign = marginValue === 0 ? '' : marginValue < 0 ? `-=${Math.abs(marginValue)}${marginUnit}` : `+=${marginValue}${marginUnit}`;
      const start = `top ${startPct}%${sign}`;

      gsap.fromTo(
        targets,
        { ...from },
        {
          ...to,
          duration,
          ease,
          stagger: delay / 1000,
          scrollTrigger: {
            trigger: el,
            start,
            once: true,
            fastScrollEnd: true,
            anticipatePin: 0.4,
            invalidateOnRefresh: true,
          },
          onComplete: () => onLetterAnimationComplete?.(),
          force3D: true,
          willChange: 'transform, opacity' as any,
        }
      );

      return () => {
        ScrollTrigger.getAll().forEach((st: ScrollTrigger) => {
          if (st.trigger === el) st.kill();
        });
      };
    },
    { scope: ref, dependencies: [text, delay, duration, ease, JSON.stringify(from), JSON.stringify(to), threshold, rootMargin, fontsLoaded] }
  );

  const WrapperTag = tag as any;
  const parentStyle: React.CSSProperties = {
    textAlign,
    overflow: 'hidden',
    display: 'inline-block',
    whiteSpace: 'normal',
    overflowWrap: 'normal',
    wordBreak: 'normal',
    hyphens: 'manual',
    willChange: 'transform, opacity',
    ...style,
  };

  return (
    <WrapperTag ref={ref} className={`split-parent ${className}`} style={parentStyle}>
      {parts.tokens.map((t, i) => (
        <span
          key={i}
          className="split-unit"
          style={{
            display: t.isSpace ? 'inline' : 'inline-block',
            whiteSpace: t.isSpace ? 'normal' : 'nowrap',
          }}
        >
          {t.text}
        </span>
      ))}
    </WrapperTag>
  );
};

export default SplitText;
