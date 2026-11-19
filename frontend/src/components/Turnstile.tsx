import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Cloudflare Turnstile, rendered explicitly so React controls the widget lifecycle.
// Docs: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// Cloudflare's documented test site key: always passes. Only used outside production.
const TEST_SITE_KEY = '1x00000000000000000000AA';

export const TURNSTILE_SITE_KEY =
  process.env.REACT_APP_TURNSTILE_SITE_KEY ||
  (process.env.NODE_ENV === 'production' ? '' : TEST_SITE_KEY);

type RenderOptions = {
  sitekey: string;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (code: string) => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: RenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable')));
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

type Props = {
  action: string;
  theme: 'light' | 'dark';
  onToken: (token: string | null) => void;
  onError: (message: string) => void;
};

const Turnstile = forwardRef<TurnstileHandle, Props>(({ action, theme, onToken, onError }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };

  useImperativeHandle(ref, () => ({
    reset: () => {
      callbacks.current.onToken(null);
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme,
          // 'flexible' has a 300px minimum width; narrow form columns get the compact layout instead.
          size: containerRef.current.clientWidth >= 300 ? 'flexible' : 'compact',
          callback: (token) => callbacks.current.onToken(token),
          'expired-callback': () => callbacks.current.onToken(null),
          'error-callback': () => {
            callbacks.current.onToken(null);
            callbacks.current.onError('The spam check could not load. Refresh the page and try again.');
          },
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onError('The spam check could not load. Check your connection or disable content blockers, then refresh.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
      callbacks.current.onToken(null);
    };
  }, [action, theme]);

  return <div ref={containerRef} style={{ minHeight: '65px' }} />;
});

Turnstile.displayName = 'Turnstile';

export default Turnstile;
