import React from 'react';
import { GitHubIcon, LinkedInIcon, XIcon, EmailIcon } from './components/Icons';

// Single source for social links: the footer, Contact page and Home page all render from this list.
// To add a network, add an entry here (and an icon in Icons.tsx).
export type SocialLink = {
  label: string;
  href: string;
  subtitle: string;
  icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  external: boolean;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/NotTanJune', subtitle: 'github.com/NotTanJune', icon: GitHubIcon, external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tanmay-nargas', subtitle: 'linkedin.com/in/tanmay-nargas', icon: LinkedInIcon, external: true },
  { label: 'X', href: 'https://x.com/nottanjune', subtitle: 'x.com/nottanjune', icon: XIcon, external: true },
];

export const EMAIL_LINK: SocialLink = {
  label: 'Email', href: 'mailto:tanmaynargas291@gmail.com', subtitle: 'tanmaynargas291@gmail.com', icon: EmailIcon, external: false,
};
