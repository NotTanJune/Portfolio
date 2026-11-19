import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../utils/useIsMobile';
import { colors, AnimatedSection } from '../../App';

// Shown for any URL without a route. The server sends a 404 status for these paths too.
// Layout mirrors the Home hero: eyebrow, large heading, green accent line, then actions.
const NotFound: React.FC = () => {
  const isMobile = useIsMobile();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const buttonBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    padding: '0 24px',
    height: '40px',
    borderRadius: '6px',
    textDecoration: 'none',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  };

  const outlineLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{ ...buttonBase, backgroundColor: 'transparent', color: colors.primaryText, border: `1px solid ${colors.fernGreen}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.fernGreen;
        e.currentTarget.style.color = colors.white;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = colors.primaryText;
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.mainBg,
      color: colors.primaryText,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: isMobile ? '120px 20px 80px' : '140px 40px 100px',
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '760px', width: '100%' }}>
        <AnimatedSection direction="up" delay={100}>
          <p style={{
            fontSize: '1.25rem',
            color: colors.accentText,
            fontWeight: '500',
            margin: '0 0 10px',
            letterSpacing: '2px'
          }}>
            Error 404
          </p>
          <h1 style={{
            fontSize: 'clamp(3rem, 8vw, 5rem)',
            fontWeight: '500',
            margin: '0 0 20px',
            color: colors.primaryText,
            lineHeight: '1.1',
            letterSpacing: '-2px'
          }}>
            Page not found
          </h1>
          <h2 style={{
            fontSize: 'clamp(1.4rem, 4.5vw, 2.25rem)',
            fontWeight: '600',
            color: colors.buttonPrimary,
            margin: '0 0 28px',
            lineHeight: '1.15'
          }}>
            Looks like this route was hallucinated.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" delay={250}>
          <p style={{
            fontSize: isMobile ? '1rem' : '1.15rem',
            color: colors.secondaryText,
            maxWidth: '520px',
            margin: '0 auto 40px',
            lineHeight: '1.6'
          }}>
            The link may be old or mistyped. Try one of these instead.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" delay={400}>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/"
              style={{ ...buttonBase, backgroundColor: colors.buttonPrimary, color: colors.white, border: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.buttonHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.buttonPrimary; }}
            >
              Back to home
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </Link>
            {outlineLink('/projects', 'View My Work')}
            {outlineLink('/contact', 'Contact')}
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default NotFound;
