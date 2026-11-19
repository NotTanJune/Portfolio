import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Projects from './Projects';

jest.mock('../AnimatedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../App', () => ({
  colors: {
    mainBg: '#ffffff',
    primaryText: '#111111',
    secondaryText: '#555555',
    buttonPrimary: '#111111',
    white: '#ffffff',
    borderColor: '#dddddd',
    accentHover: '#eeeeee',
    accentText: '#333333',
    techBg: '#f5f5f5',
  },
  CARD_RADIUS: '8px',
  AnimatedSection: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  window.scrollTo = jest.fn();
});

test('filter includes projects with multiple categories', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'CLI Tool' }));

  expect(screen.getByRole('heading', { name: 'Locator (lctr)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'DevDéx' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Anglerfish' })).not.toBeInTheDocument();
});

test('iOS App filter shows Kelpie and Every Round', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));

  expect(screen.getByRole('heading', { name: 'Kelpie' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Every Round' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Locator (lctr)' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kelpie announcement on X' })).toHaveAttribute('href', 'https://x.com/nottanjune/status/2111028384327458821');
});
