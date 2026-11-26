import React, { useState, useEffect, useLayoutEffect, useRef, useContext, useMemo, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';
import LoadingScreen from './components/LoadingScreen';
import SeoMetadata from './components/SeoMetadata';
import { motion, AnimatePresence, usePresence, useAnimation, useInView as fmUseInView, useReducedMotion } from 'framer-motion';
import { useAnimationRefresh } from './utils/useAnimationRefresh';
import { useIsMobile } from './utils/useIsMobile';
import { hoverStyleHandlers } from './utils/styleHelpers';
import { SunIcon, MoonIcon, CloseIcon, HamburgerIcon, CopyrightIcon } from './components/Icons';
import { SOCIAL_LINKS, EMAIL_LINK } from './socialLinks';
import {
  Theme,
  applyColorScheme,
  getSystemTheme,
  nextOverride,
  onSystemThemeChange,
  readOverride,
  writeOverride,
  COLOR_SCHEME_KEY,
} from './utils/colorScheme';

const Home = React.lazy(() => import('./components/pages/Home'));
const Projects = React.lazy(() => import('./components/pages/Projects'));
const Contact = React.lazy(() => import('./components/pages/Contact'));
const Resume = React.lazy(() => import('./components/pages/Resume'));
const NotFound = React.lazy(() => import('./components/pages/NotFound'));

// Fired from the resolved route, after it has committed layout. The shell stays
// hidden until then so the footer never paints above an empty main.
const ContentReadyContext = React.createContext<() => void>(() => {});

const RouteContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const markReady = useContext(ContentReadyContext);
  useLayoutEffect(() => {
    markReady();
  }, [markReady]);
  return <>{children}</>;
};

const RouteFallback: React.FC = () => (
  <div
    aria-hidden="true"
    style={{
      minHeight: '100dvh',
      backgroundColor: colors.mainBg,
    }}
  />
);

// Route transitions follow the nav order.
// Desktop: a shared X axis. Going right in the nav (Projects -> Resume) the old page leaves to the
// left and the new one arrives from the right; going back reverses it.
// Phone: a depth stack. Going forward, the new page rises as a sheet over the old one, which
// recedes; going back, the current page drops away and the previous one comes forward.
// Routes outside the nav (404) crossfade without moving. Reduced motion crossfades everywhere.
const NAV_ORDER = ['/', '/projects', '/resume', '/contact'];
const ROUTE_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const ROUTE_OUT_MS = 360;
const ROUTE_IN_MS = 600;
const ROUTE_IN_DELAY_MS = 120;
const ROUTE_SHIFT_PX = 40;
const ROUTE_REDUCED_OUT_MS = 150;
const ROUTE_REDUCED_IN_MS = 250;
const STACK_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const STACK_IN_MS = 840;
const STACK_OUT_MS = 760;
const STACK_RECEDED = { transform: 'scale(0.94)', opacity: 0.55 };
const STACK_SHEET_SHADOW = '0 -12px 32px rgba(0, 0, 0, 0.22)';
// The active nav pill glides between tabs on the same clock as the page.
const NAV_PILL_MS = 600;
const NAV_PILL_EASE = 'cubic-bezier(0.77, 0, 0.175, 1)';

type PillBox = { x: number; w: number };
type PillState = { link: HTMLElement; from: PillBox | null; to: PillBox; anim: Animation | null };

const measurePill = (link: HTMLElement, base: DOMRect): PillBox => {
  const box = link.getBoundingClientRect();
  return { x: box.left - base.left, w: box.width };
};

// Where the pill is drawn right now: partway along a running glide, or on its tab.
const pillPosition = (s: PillState, base: DOMRect): PillBox | null => {
  const p = s.anim?.playState === 'running' ? s.anim.effect?.getComputedTiming().progress : null;
  if (s.from && p != null) {
    return { x: s.from.x + (s.to.x - s.from.x) * p, w: s.from.w + (s.to.w - s.from.w) * p };
  }
  return s.link.isConnected ? measurePill(s.link, base) : null;
};

type RouteStyle = 'fade' | 'axis' | 'stack';
type RouteMotion = { dir: number; style: RouteStyle };
const RouteMotionContext = React.createContext<React.MutableRefObject<RouteMotion>>({
  current: { dir: 0, style: 'fade' },
});

type LayerMotion = {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  style?: Partial<CSSStyleDeclaration>; // applied for the length of the animation
};

// How the arriving page moves in.
const enterMotion = ({ dir, style }: RouteMotion): LayerMotion => {
  if (style === 'stack' && dir > 0) {
    return {
      keyframes: [{ transform: `translateY(${window.innerHeight}px)` }, { transform: 'translateY(0px)' }],
      options: { duration: STACK_IN_MS, easing: STACK_EASE },
      style: { boxShadow: STACK_SHEET_SHADOW },
    };
  }
  if (style === 'stack' && dir < 0) {
    return {
      keyframes: [STACK_RECEDED, { transform: 'scale(1)', opacity: 1 }],
      options: { duration: STACK_IN_MS, easing: STACK_EASE },
      style: { transformOrigin: '50% 0px' },
    };
  }
  if (style === 'fade') {
    return { keyframes: [{ opacity: 0 }, { opacity: 1 }], options: { duration: ROUTE_REDUCED_IN_MS, easing: ROUTE_EASE } };
  }
  const from = `translateX(${dir * ROUTE_SHIFT_PX}px)`;
  return {
    keyframes: [{ opacity: 0, transform: from }, { opacity: 1, transform: 'translateX(0px)' }],
    options: { duration: ROUTE_IN_MS, delay: ROUTE_IN_DELAY_MS, easing: ROUTE_EASE },
  };
};

// How the leaving page moves out. It is already pinned (position: fixed) at its on-screen spot;
// `visibleTop` is how far its top sits above the viewport, so it shrinks toward what was on screen.
const exitMotion = ({ dir, style }: RouteMotion, visibleTop: number): LayerMotion => {
  if (style === 'stack' && dir > 0) {
    return {
      keyframes: [STACK_RECEDED],
      options: { duration: STACK_IN_MS, easing: STACK_EASE },
      style: { transformOrigin: `50% ${visibleTop}px` },
    };
  }
  if (style === 'stack' && dir < 0) {
    return {
      keyframes: [{ transform: `translateY(${window.innerHeight}px)` }],
      options: { duration: STACK_OUT_MS, easing: STACK_EASE },
      // The page dropping away sits above the one coming forward, cut off at the top of the
      // viewport so only what was on screen falls away (not the part scrolled past above it).
      style: { zIndex: '1', clipPath: `inset(${visibleTop}px 0px 0px 0px)` },
    };
  }
  if (style === 'fade') {
    return { keyframes: [{ opacity: 0 }], options: { duration: ROUTE_REDUCED_OUT_MS, easing: ROUTE_EASE } };
  }
  return {
    keyframes: [{ opacity: 0, transform: `translateX(${-dir * ROUTE_SHIFT_PX}px)` }],
    options: { duration: ROUTE_OUT_MS, easing: ROUTE_EASE },
  };
};

// One page in the route stack. It animates in when it mounts from a navigation; when it leaves,
// it is pinned where it was on screen (position: fixed) so the window can scroll to the top for
// the new page without the old one jumping.
const RouteLayer: React.FC<{ animateIn: boolean; children: React.ReactNode }> = ({ animateIn, children }) => {
  const [isPresent, safeToRemove] = usePresence();
  const motionRef = useContext(RouteMotionContext);
  const ref = useRef<HTMLDivElement>(null);
  const animateInRef = useRef(animateIn);
  const enterRef = useRef<Animation | null>(null);
  const safeToRemoveRef = useRef(safeToRemove);
  safeToRemoveRef.current = safeToRemove;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animateInRef.current || typeof el.animate !== 'function') return;
    const { keyframes, options, style } = enterMotion(motionRef.current);
    if (style) Object.assign(el.style, style);
    const clear = () => {
      if (style) Object.keys(style).forEach((k) => el.style.removeProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)));
    };
    const anim = el.animate(keyframes, { ...options, fill: 'backwards' });
    enterRef.current = anim;
    anim.finished.then(clear, () => {});
    return () => {
      anim.cancel();
      clear();
    };
  }, [motionRef]);

  useLayoutEffect(() => {
    if (isPresent) return;
    const el = ref.current;
    const done = () => safeToRemoveRef.current?.();
    if (!el || typeof el.animate !== 'function') {
      done();
      return;
    }
    // Start from wherever an interrupted entrance had got to.
    const current = getComputedStyle(el);
    const start: Keyframe = {
      opacity: current.opacity,
      transform: current.transform === 'none' ? 'translate(0px, 0px)' : current.transform,
    };
    enterRef.current?.cancel();

    const rect = el.getBoundingClientRect();
    el.setAttribute('inert', '');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: '-1',
      pointerEvents: 'none',
    });

    const { keyframes, options, style } = exitMotion(motionRef.current, -rect.top);
    if (style) Object.assign(el.style, style);
    const anim = el.animate([start, ...keyframes], { ...options, fill: 'forwards' });
    anim.finished.then(done, () => {});
    return () => anim.cancel();
  }, [isPresent, motionRef]);

  return <div ref={ref}>{children}</div>;
};

const RouteTransitions: React.FC = () => {
  const location = useLocation();
  const { pathname } = location;
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  const prevPathRef = useRef(pathname);
  const motionRef = useRef<RouteMotion>({ dir: 0, style: 'fade' });

  // Set during render so the leaving and the arriving layer read the same motion in their
  // layout effects. Same inputs give the same value, so a repeated render is harmless.
  const navigated = prevPathRef.current !== pathname;
  if (navigated) {
    const from = NAV_ORDER.indexOf(prevPathRef.current);
    const to = NAV_ORDER.indexOf(pathname);
    const dir = from < 0 || to < 0 ? 0 : Math.sign(to - from);
    motionRef.current = {
      dir,
      style: reduce || dir === 0 ? 'fade' : isMobile ? 'stack' : 'axis',
    };
  }

  // Runs after the layers' layout effects, so the leaving page is already pinned.
  useLayoutEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <RouteMotionContext.Provider value={motionRef}>
      <AnimatePresence initial={false}>
        <RouteLayer key={pathname} animateIn={navigated}>
          <Routes location={location}>
            <Route path="/" element={<RouteContent><Home /></RouteContent>} />
            <Route path="/projects" element={<RouteContent><Projects /></RouteContent>} />
            <Route path="/contact" element={<RouteContent><Contact /></RouteContent>} />
            <Route path="/resume" element={<RouteContent><Resume /></RouteContent>} />
            <Route path="*" element={<RouteContent><NotFound /></RouteContent>} />
          </Routes>
        </RouteLayer>
      </AnimatePresence>
    </RouteMotionContext.Provider>
  );
};

// Lightweight context to delay animations until the loading screen completes
type AnimationContextType = { canAnimate: boolean };
export const AnimationContext = React.createContext<AnimationContextType>({ canAnimate: true });

interface AnimatedSectionProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedSection: React.FC<AnimatedSectionProps> = ({ 
  children, 
  direction = 'up', 
  delay = 0,
  className,
  style 
}) => {
  const { canAnimate } = useContext(AnimationContext);
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = fmUseInView(ref, { amount: 0.1, once: true });
  const controls = useAnimation();

  const offset = 30;
  const initialShift = (() => {
    if (shouldReduceMotion) return { x: 0, y: 0 };
    switch (direction) {
      case 'up': return { x: 0, y: offset };
      case 'down': return { x: 0, y: -offset };
      case 'left': return { x: offset, y: 0 };
      case 'right': return { x: -offset, y: 0 };
      default: return { x: 0, y: offset };
    }
  })();

  useEffect(() => {
    if (canAnimate && isInView) {
      controls.start('visible');
    }
  }, [canAnimate, isInView, controls]);

  const variants = {
    hidden: { opacity: 0, x: initialShift.x, y: initialShift.y },
    visible: { opacity: 1, x: 0, y: 0 }
  } as const;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      animate={controls}
      variants={variants}
      transition={{ duration: 0.5, ease: [0.1, 0.1, 0.1, 0.1], delay: (delay ?? 0) / 1000 }}
    >
      {children}
    </motion.div>
  );
};

// Colour scheme constants (light theme)
export const colors = {
  // Main color palette 
  mainBg: '#dad7cd',   
  cardBg: '#f0efeb',
  lightBg: '#f8f7f5',
  techBg: '#b4baad',
  
  // Green accents for text and interactive elements
  primaryText: '#344e41',
  secondaryText: '#3a5a40',
  accentText: '#588157',
  mutedText: '#a3b18a',
  
  // Interactive elements
  buttonPrimary: '#588157',
  buttonHover: '#3a5a40',
  borderColor: '#b6b09c',

  // Dark elements (for contrast)
  darkAccent: '#344e41',
  white: '#ffffff',
  
  // Legacy color names for compatibility
  timberwolf: '#dad7cd',
  sage: '#a3b18a',
  fernGreen: '#588157',
  hunterGreen: '#3a5a40',
  brunswickGreen: '#344e41',
  
  // Opacity variations
  transparentBg: 'rgba(218, 215, 205, 0.3)',
  overlayBg: 'rgba(218, 215, 205, 0.95)',
  accentHover: 'rgba(88, 129, 87, 0.1)'
};

// Shared UI constants
export const CARD_RADIUS = '12px';

// Dark theme colours
const darkColors = {
  // Main color palette - inverted backgrounds
  mainBg: '#1a2419',
  cardBg: '#344e41',
  lightBg: '#3a5a40',
  techBg: '#2d3d2a',
  
  // Light text (inverted)
  primaryText: '#f0efeb',
  secondaryText: '#dad7cd',
  accentText: '#a3b18a',
  mutedText: '#788a6f',
  
  // Interactive elements - keep vibrant
  buttonPrimary: '#588157',
  buttonHover: '#6b9a69',
  borderColor: '#4a5c48',
  
  // Accents
  darkAccent: '#0f1810',
  white: '#fafafa',
  
  // Opacity variations
  transparentBg: 'rgba(26, 36, 25, 0.3)',
  overlayBg: 'rgba(26, 36, 25, 0.95)',
  accentHover: 'rgba(88, 129, 87, 0.15)',

  // Legacy color names for compatibility (map to closest dark equivalents)
  timberwolf: '#dad7cd',
  sage: '#a3b18a',
  fernGreen: '#588157',
  hunterGreen: '#3a5a40',
  brunswickGreen: '#344e41',
};

// Theme context for light/dark switching
type ThemeContextType = {
  theme: Theme;
  colors: typeof colors;
  toggleTheme: () => void;
};
export const ThemeContext = React.createContext<ThemeContextType>({
  theme: 'light',
  colors,
  toggleTheme: () => {},
});

// Keep a snapshot of the original light palette so we can swap back
const lightPaletteSnapshot = { ...colors };


// Announces route changes for screen readers
const RouteAnnouncer: React.FC = () => {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const pageName = (() => {
      switch (location.pathname) {
        case '/': return 'Home';
        case '/projects': return 'Projects';
        case '/contact': return 'Contact';
        case '/resume': return 'Resume';
        default: return 'Page';
      }
    })();
    setAnnouncement(`Navigated to ${pageName}`);
  }, [location.pathname]);

  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  );
};

// Navbar Component
const MOBILE_MENU_ID = 'mobile-nav-menu';
export const Navbar: React.FC = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu's highlighted item only follows the route while the menu is open. It closes on tap,
  // and the new page commits a moment later; without this the highlight would slide to the
  // tapped item while the menu fades out.
  const menuPathRef = useRef(location.pathname);
  if (menuOpen) menuPathRef.current = location.pathname;
  const menuPath = menuPathRef.current;
  const [needsHamburger, setNeedsHamburger] = useState(false);
  const linksContainerRef = useRef<HTMLDivElement>(null);
  const navInnerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillStateRef = useRef<PillState | null>(null);

  // Glide the active pill from the previous tab to the new one. Positions are measured against
  // the nav itself (it is fixed), so the window scroll reset on navigation can't move the pill.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const inner = navInnerRef.current;
    const link = pill?.parentElement;
    const prev = pillStateRef.current;
    if (!pill || !inner || !link) {
      prev?.anim?.cancel();
      pillStateRef.current = null;
      return;
    }
    const base = inner.getBoundingClientRect();
    const to = measurePill(link, base);
    const from = prev ? pillPosition(prev, base) : null;
    prev?.anim?.cancel();

    let anim: Animation | null = null;
    if (from && !reduceMotion && Math.abs(from.x - to.x) > 0.5 && typeof pill.animate === 'function') {
      // width animates on a childless, absolutely positioned span: no layout outside it.
      anim = pill.animate(
        [
          { transform: `translateX(${from.x - to.x}px)`, width: `${from.w}px` },
          { transform: 'translateX(0px)', width: `${to.w}px` },
        ],
        { duration: NAV_PILL_MS, easing: NAV_PILL_EASE }
      );
    }
    pillStateRef.current = { link, from, to, anim };
  }, [location.pathname, needsHamburger, reduceMotion]);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;

      // Compute if nav items overflow the available space
      const parentW = navInnerRef.current?.clientWidth ?? 0;
      const controlsW = controlsRef.current?.clientWidth ?? 0;
      const available = Math.max(0, parentW - controlsW - 16); // padding gap
      const linksScrollW = linksContainerRef.current?.scrollWidth ?? 0;
      const overflow = linksScrollW > available + 1; // allow tiny rounding
      setNeedsHamburger(mobile || overflow);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    if (navInnerRef.current) ro.observe(navInnerRef.current);
    if (linksContainerRef.current) ro.observe(linksContainerRef.current);
    if (controlsRef.current) ro.observe(controlsRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      try { ro.disconnect(); } catch {}
    };
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  // Close from inside the menu (close button, backdrop, Escape) returns focus to the hamburger;
  // a route change closes it without moving focus.
  const restoreFocusRef = useRef(false);
  const closeMenu = useCallback(() => {
    restoreFocusRef.current = true;
    setMenuOpen(false);
  }, []);

  // The menu only exists while the hamburger is shown.
  useEffect(() => {
    if (!needsHamburger) setMenuOpen(false);
  }, [needsHamburger]);

  // While open: the page behind is inert, focus starts on the first item and is trapped, Escape closes.
  const menuActive = menuOpen && needsHamburger;
  useEffect(() => {
    if (!menuActive) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        hamburgerRef.current?.focus();
      }
      return;
    }
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const menu = document.getElementById(MOBILE_MENU_ID);
    const focusables = () =>
      Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root?.removeAttribute('inert');
    };
  }, [menuActive, closeMenu]);

  return (
    <nav style={{
      position: 'fixed', 
      top: isMobile ? '12px' : '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: isMobile ? '97%' : '95%',
      maxWidth: '1200px',
      backgroundColor: colors.transparentBg, 
      backdropFilter: 'blur(20px)',
      border: `1px solid ${colors.borderColor}`,
      borderRadius: isMobile ? '16px' : '12px',
      zIndex: 1000,
      padding: isMobile ? '10px 16px' : '12px 24px',
      transition: 'all 0.3s ease',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
    }}>
      <div ref={navInnerRef} style={{ 
        display: 'flex', 
        justifyContent: isMobile ? (needsHamburger ? 'flex-end' : 'space-between') : 'flex-end', 
        alignItems: 'center',
        width: '100%',
        position: 'relative'
      }}>
        {/* Mobile brand/title on left when hamburger is present */}
        {isMobile && needsHamburger && (
          <Link
            to="/"
            style={{
              position: 'absolute',
              left: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '0px',
              color: colors.primaryText,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              lineHeight: 1
            }}
            aria-label="Go to Portfolio home"
          >
            Portfolio
          </Link>
        )}
        
        {/* Center - Navigation items */}
        <div ref={linksContainerRef} style={{ 
          gap: isMobile ? '6px' : '8px',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: 'center',
          position: isMobile ? 'static' : 'absolute',
          left: isMobile ? 'auto' : '50%',
          transform: isMobile ? 'none' : 'translateX(-50%)',
          display: isMobile && needsHamburger ? 'none' : 'flex',
          width: isMobile ? (needsHamburger ? 'auto' : 'calc(100% - 96px)') : 'auto',
          overflow: 'hidden'
        }}>
          {[
            { to: '/', label: 'Home' },
            { to: '/projects', label: 'Projects' },
            { to: '/resume', label: 'Resume' },
            { to: '/contact', label: 'Contact' }
          ].map((item, index) => (
            <AnimatedSection key={item.to} direction="down" delay={200 + index * 100}>
              <Link 
                to={item.to} 
                aria-current={location.pathname === item.to ? 'page' : undefined}
                style={{ 
                  color: colors.primaryText,
                  backgroundColor: 'transparent',
                  position: 'relative',
                  isolation: 'isolate',
                  textDecoration: 'none',
                  fontWeight: location.pathname === item.to ? '600' : '500',
                  fontSize: isMobile ? '0.95rem' : '1rem',
                  transition: 'all 0.3s ease',
                  padding: isMobile ? '10px 14px' : '8px 16px',
                  minHeight: isMobile ? '44px' : undefined,
                  minWidth: isMobile ? '44px' : undefined,
                  borderRadius: isMobile ? '8px' : '6px',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== item.to) {
                    e.currentTarget.style.backgroundColor = colors.accentHover;
                    e.currentTarget.style.color = colors.primaryText;
                  }
                }}
                onMouseLeave={(e) => {
                  // Always clear: a link hovered and then clicked would otherwise keep the tint
                  // after it stops being the active page (the pill now carries the active state).
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.primaryText;
                }}
                onFocus={(e) => {
                  if (location.pathname !== item.to) {
                    e.currentTarget.style.backgroundColor = colors.accentHover;
                    e.currentTarget.style.color = colors.primaryText;
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.primaryText;
                }}
              >
                {location.pathname === item.to && (
                  <span
                    ref={pillRef}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      zIndex: -1,
                      borderRadius: isMobile ? '8px' : '6px',
                      backgroundColor: colors.techBg,
                    }}
                  />
                )}
                {item.label}
              </Link>
            </AnimatedSection>
          ))}
        </div>

        {/* Right side - Theme toggle */}
        <AnimatedSection direction="right" delay={600}>
          <div
            style={{
              minWidth: isMobile ? (needsHamburger ? '84px' : '40px') : '160px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0
            }}
            ref={controlsRef}
          >
            <button
              aria-label="Toggle theme"
              onClick={toggleTheme}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                border: `1px solid ${colors.borderColor}`,
                backgroundColor: colors.transparentBg,
                color: colors.primaryText,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
              }}
              {...hoverStyleHandlers(
                { backgroundColor: colors.mainBg },
                { backgroundColor: colors.transparentBg }
              )}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <SunIcon size={18} strokeWidth={1} /> : <MoonIcon size={18} strokeWidth={1} />}
            </button>

            {/* Hamburger - visible on mobile or when links overflow */}
            {needsHamburger && (
              <button
                ref={hamburgerRef}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? MOBILE_MENU_ID : undefined}
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.borderColor}`,
                  backgroundColor: colors.transparentBg,
                  color: colors.primaryText,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                }}
                {...hoverStyleHandlers(
                  { backgroundColor: colors.mainBg },
                  { backgroundColor: colors.transparentBg }
                )}
                title={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? <CloseIcon size={18} strokeWidth={1} /> : <HamburgerIcon size={18} strokeWidth={1} />}
              </button>
            )}
          </div>
        </AnimatedSection>
      </div>

      {/* Mobile/overflow compact menu, portaled to body so the whole page blurs. It stays mounted so the
          open/close animation needs no AnimatePresence, and while closed it is inert and aria-hidden,
          so neither keyboard nor screen reader can reach it. Focus handling is in the
          effect above (no dialog library, to keep main.js small for first visits). */}
      {needsHamburger && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop - outside the nav to blur the entire page */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: menuOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: menuOpen ? 'rgba(0,0,0,0.35)' : 'transparent',
              backdropFilter: menuOpen ? 'blur(6px)' : 'none',
              WebkitBackdropFilter: menuOpen ? 'blur(6px)' : 'none',
              pointerEvents: menuOpen ? 'auto' : 'none',
              zIndex: 9998,
            }}
            onClick={closeMenu}
          />

          {/* Floating popup menu */}
          <motion.div
            id={MOBILE_MENU_ID}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: menuOpen ? 1 : 0, scale: menuOpen ? 1 : 0.96, y: menuOpen ? 0 : -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            inert={!menuOpen}
            aria-hidden={menuOpen ? undefined : true}
            style={{
              position: 'fixed',
              top: isMobile ? '72px' : '80px',
              right: isMobile ? '16px' : '24px',
              width: 'min(88vw, 340px)',
              maxHeight: '70vh',
              overflowY: 'auto',
              borderRadius: '18px',
              backgroundColor: colors.overlayBg,
              // Keep the card crisp and in focus; blur is applied to the backdrop only
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: 'none',
              boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
              zIndex: 9999,
              pointerEvents: menuOpen ? 'auto' : 'none'
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            {/* Header with close (no bottom border) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 14px' }}>
              <button
                aria-label="Close menu"
                onClick={closeMenu}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '34px', height: '34px', borderRadius: '10px',
                  border: 'none', backgroundColor: colors.transparentBg,
                  color: colors.primaryText, cursor: 'pointer'
                }}
                {...hoverStyleHandlers(
                  { backgroundColor: colors.mainBg },
                  { backgroundColor: colors.transparentBg }
                )}
              >
                <CloseIcon size={18} strokeWidth={1} />
              </button>
            </div>

            <motion.ul
              initial="hidden"
              animate={menuOpen ? 'visible' : 'hidden'}
              variants={{
                hidden: { transition: { staggerChildren: 0.06, staggerDirection: -1 } },
                visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05, staggerDirection: 1 } }
              }}
              style={{ listStyle: 'none', margin: 0, padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {[
                { to: '/', label: 'Home' },
                { to: '/projects', label: 'Projects' },
                { to: '/resume', label: 'Resume' },
                { to: '/contact', label: 'Contact' }
              ].map((item, index) => (
                <motion.li key={`menu-${item.to}-${index}`} variants={{ hidden: { opacity: 0, x: 6 }, visible: { opacity: 1, x: 0 } }}>
                  <Link
                    to={item.to}
                    aria-current={location.pathname === item.to ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block', padding: '14px 16px', borderRadius: '16px', textDecoration: 'none',
                      color: colors.primaryText, backgroundColor: menuPath === item.to ? colors.techBg : colors.transparentBg,
                      fontSize: '1.05rem', fontWeight: 600, border: 'none',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = colors.accentHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = menuPath === item.to ? colors.techBg : colors.transparentBg; }}
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </>,
        document.body
      )}
    </nav>
  );
};


// Footer Component
const Footer: React.FC = () => {
  const isMobile = useIsMobile();
  const { theme } = useContext(ThemeContext);

  const footerBg = theme === 'dark' ? colors.techBg : colors.brunswickGreen;

    return (
    <footer style={{
      backgroundColor: footerBg,
      padding: isMobile ? '30px 0' : '40px 0',
      width: '100%',
      boxSizing: 'border-box',
      flexShrink: 0
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '0 20px' : '0 40px',
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile ? 'none' : 'repeat(auto-fit, minmax(250px, 1fr))',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '30px' : '40px'
      }}>
        {/* About Section */}
        <div>
          <h3 style={{
            color: colors.timberwolf,
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            marginBottom: '20px',
            fontWeight: '600'
          }}>
            Tanmay Nargas
          </h3>
          <p style={{
            color: colors.sage,
            lineHeight: '1.6',
            marginBottom: '20px',
            fontSize: isMobile ? '0.85rem' : '0.9rem',
            fontWeight: '500'
          }}>
            AI Engineer based in Singapore, specialized in 
            creating intelligent solutions and cutting-edge applications.
          </p>
        </div>
        {/* Connect Section */}
        <div style={{
          textAlign: isMobile ? 'left' : 'right'
        }}>
          <h3 style={{
            color: colors.timberwolf,
            fontSize: isMobile ? '1.1rem' : '1.2rem',
            marginBottom: '20px',
            fontWeight: '600'
          }}>
            Connect
          </h3>
          <div style={{
            display: 'flex',
            gap: isMobile ? '12px' : '15px',
            justifyContent: isMobile ? 'flex-start' : 'flex-end',
            flexWrap: 'wrap'
          }}>
            {[...SOCIAL_LINKS, EMAIL_LINK].map(({ href, label, icon: Icon, external }) => (
              <a
                key={label}
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                aria-label={label}
                style={{
                  color: colors.sage,
                  fontSize: '1.2rem',
                  transition: 'color 0.3s ease, background-color 0.3s ease',
                  padding: '8px',
                  borderRadius: '50%',
                  backgroundColor: colors.hunterGreen,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px'
                }}
                {...hoverStyleHandlers(
                  { color: colors.primaryText, backgroundColor: colors.mainBg },
                  { color: colors.sage, backgroundColor: colors.hunterGreen }
                )}
              >
                <Icon size={22} style={{ pointerEvents: 'none' }} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        marginTop: isMobile ? '30px' : '40px',
        paddingTop: '20px',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isMobile ? '0 20px' : '0 40px',
          display: 'flex',
          justifyContent: isMobile ? 'center' : 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{
            color: colors.sage,
            fontSize: isMobile ? '0.8rem' : '0.9rem',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textAlign: isMobile ? 'center' : 'left'
          }}>
            <CopyrightIcon size={14} />
            <span>{new Date().getFullYear()} Tanmay Nargas. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

function App() {
  const [fontLoaded, setFontLoaded] = useState(false);
  // Theme state
  // No override means the site follows the system scheme, including live changes.
  const [override, setOverride] = useState<Theme | null>(readOverride);
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme);
  const theme: Theme = override ?? systemTheme;

  // Compute palette synchronously so render sees the right colors immediately
  const palette = useMemo(() => (theme === 'dark' ? darkColors : lightPaletteSnapshot), [theme]);
  Object.assign(colors, palette);

  // Reflect the scheme on <html> and <meta name="color-scheme"> before paint
  useLayoutEffect(() => {
    try { applyColorScheme(theme, override); } catch {}
  }, [theme, override]);

  useEffect(() => onSystemThemeChange(setSystemTheme), []);

  // Keep tabs in sync when another tab changes the override
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLOR_SCHEME_KEY || event.key === null) setOverride(readOverride());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = () => {
    try {
      document.documentElement.classList.add('theme-transition');
    } catch {}
    // Toggle against what is rendered; toggling back to the system scheme clears the override.
    const next = nextOverride(theme, getSystemTheme());
    writeOverride(next);
    setOverride(next);
    // Remove the class after the transition window
    window.setTimeout(() => {
      try { document.documentElement.classList.remove('theme-transition'); } catch {}
    }, 280);
  };
  // Native scroll only — no smooth-scroll library (avoids scroll hijacking / input lag).
  // Show loader only on first visit
  const initialIsLoading = (() => {
    try { return localStorage.getItem('visited') === '1' ? false : true; } catch { return true; }
  })();
  const [isLoading, setIsLoading] = useState(initialIsLoading);
  const [canAnimate, setCanAnimate] = useState(!initialIsLoading);
  const [contentReady, setContentReady] = useState(false);
  // Created once so the loader can wait on the route's layout commit, not only
  // the chunk download. A cached import() still suspends for a frame.
  const contentMountedRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!contentMountedRef.current) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    contentMountedRef.current = { promise, resolve };
  }
  const contentMounted = contentMountedRef.current;
  const markContentReady = useCallback(() => {
    contentMountedRef.current?.resolve();
    setContentReady(true);
  }, []);

  // Real readiness signal the loader holds at 99% for: first-paint route chunk,
  // route commit, and web fonts. Each task fails open so a slow or missing asset
  // can never deadlock the loader (a hard cap also exists there).
  const whenReady = useMemo<Promise<unknown>>(() => {
    if (!initialIsLoading) return Promise.resolve();
    const tasks: Promise<unknown>[] = [];
    // Preload the Home route chunk so the page is interactive the instant the loader lifts.
    tasks.push(import('./components/pages/Home').catch(() => undefined));
    // Hold the loader until that route has actually committed, so the reveal
    // never shows the footer sitting in an empty document.
    tasks.push(contentMounted.promise);
    // Wait for fonts so text doesn't reflow right after reveal.
    try {
      if (typeof document !== 'undefined' && (document as Document & { fonts?: FontFaceSet }).fonts) {
        tasks.push((document as Document & { fonts: FontFaceSet }).fonts.ready.catch(() => undefined));
      }
    } catch { /* no Font Loading API: skip */ }
    return Promise.all(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global ScrollTrigger refresh orchestrator
  useAnimationRefresh([]);

  useEffect(() => {
    const handleScroll = () => {
      document.body.style.cursor = 'auto';
      document.body.style.cursor = '';
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const checkFont = () => {
      try {
        if ('fonts' in document) {
          document.fonts.ready.then(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          });
          
          document.fonts.load('1em Bricolage Grotesque').then(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          }).catch(() => {
            setTimeout(() => {
              setFontLoaded(true);
              document.body.classList.add('font-loaded');
              document.body.classList.remove('font-loading');
            }, 3000);
          });
        } else {
          setTimeout(() => {
            setFontLoaded(true);
            document.body.classList.add('font-loaded');
            document.body.classList.remove('font-loading');
          }, 2000);
        }
      } catch (error) {
        console.warn('Font loading detection failed:', error);
        setFontLoaded(true);
        document.body.classList.add('font-loaded');
        document.body.classList.remove('font-loading');
      }
    };

    document.body.classList.add('font-loading');
    
    if (document.readyState === 'complete') {
      checkFont();
    } else {
      window.addEventListener('load', checkFont);
      return () => window.removeEventListener('load', checkFont);
    }
  }, []);

  // If the route never commits, reveal anyway so a failed chunk can't leave a blank page.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      contentMountedRef.current?.resolve();
      setContentReady(true);
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, []);

  const handleLoadingComplete = () => {
    try { localStorage.setItem('visited', '1'); } catch {}
    setIsLoading(false);
    window.requestAnimationFrame(() => setCanAnimate(true));
  };

  return (
    <>
      {isLoading && (
        <LoadingScreen
          onLoadingComplete={handleLoadingComplete}
          whenReady={whenReady}
        />
      )}
  <ThemeContext.Provider value={{ theme, colors: palette, toggleTheme }}>
        <AnimationContext.Provider value={{ canAnimate: canAnimate || !isLoading }}>
          <ContentReadyContext.Provider value={markContentReady}>
          <Router>
            <SeoMetadata />
            <RouteAnnouncer />
            <div
              className={`App ${fontLoaded ? 'font-loaded' : 'font-loading'}`}
              aria-hidden={isLoading || !contentReady || undefined}
              style={{
                width: '100%',
                maxWidth: '100%',
                overflowX: 'hidden',
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                // Stay hidden until the route has laid out. Otherwise the footer
                // paints under the navbar and the page jumps when content arrives.
                visibility: isLoading || !contentReady ? 'hidden' : 'visible'
              }}
            >
              <a
                href="#main-content"
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  top: 'auto',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  zIndex: 9999,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.position = 'fixed';
                  e.currentTarget.style.left = '16px';
                  e.currentTarget.style.top = '16px';
                  e.currentTarget.style.width = 'auto';
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.overflow = 'visible';
                  e.currentTarget.style.padding = '12px 24px';
                  e.currentTarget.style.backgroundColor = colors.buttonPrimary;
                  e.currentTarget.style.color = colors.white;
                  e.currentTarget.style.borderRadius = '8px';
                  e.currentTarget.style.textDecoration = 'none';
                  e.currentTarget.style.fontWeight = '500';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.position = 'absolute';
                  e.currentTarget.style.left = '-9999px';
                  e.currentTarget.style.width = '1px';
                  e.currentTarget.style.height = '1px';
                  e.currentTarget.style.overflow = 'hidden';
                }}
              >
                Skip to main content
              </a>
              <Navbar />
              <main id="main-content" style={{ flex: '1 0 auto', minHeight: '100dvh', width: '100%' }}>
                <Suspense fallback={<RouteFallback />}>
                  <RouteTransitions />
                </Suspense>
              </main>
              <Footer />
            </div>
          </Router>
          </ContentReadyContext.Provider>
        </AnimationContext.Provider>
      </ThemeContext.Provider>
    </>
  );
}

export default App;
