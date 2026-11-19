import React from 'react';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const defaultProps: Required<Pick<IconProps, 'size' | 'strokeWidth'>> = {
  size: 20,
  strokeWidth: 2,
};

const svgBase = (size: number, strokeWidth: number, style?: React.CSSProperties) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
});

export const GitHubIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

// Filled brand glyph, so it skips the stroked svgBase
export const XIcon: React.FC<IconProps> = ({ size = defaultProps.size, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const LinkedInIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export const EmailIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const HamburgerIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);

export const SpinnerIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, { animation: 'spin 1s linear infinite', ...style })}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

export const CopyrightIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M14.83 14.83a4 4 0 1 1 0-5.66" />
  </svg>
);

export const OpenInNewIcon: React.FC<IconProps> = ({ size = defaultProps.size, strokeWidth = defaultProps.strokeWidth, style }) => (
  <svg {...svgBase(size, strokeWidth, style)}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15,3 21,3 21,9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
