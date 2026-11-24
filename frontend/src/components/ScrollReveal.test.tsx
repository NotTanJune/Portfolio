/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ScrollReveal from './ScrollReveal';

// CRA sets resetMocks, so the stubs are plain functions rather than jest.fn implementations.
jest.mock('gsap', () => ({
  gsap: {
    registerPlugin: () => undefined,
    fromTo: () => ({ scrollTrigger: null }),
    set: () => undefined,
  },
}));
jest.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }));

test('renders an h2 by default', () => {
  render(<ScrollReveal>Hello there</ScrollReveal>);

  const heading = screen.getByRole('heading', { level: 2 });
  expect(heading).toHaveClass('scroll-reveal');
  expect(heading.querySelectorAll('.word')).toHaveLength(2);
});

test('as="p" renders a paragraph and adds no heading to the outline', () => {
  const { container } = render(<ScrollReveal as="p">Hello there</ScrollReveal>);

  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  const paragraph = container.querySelector('p.scroll-reveal') as HTMLElement;
  expect(paragraph).not.toBeNull();
  expect(paragraph.querySelector('.scroll-reveal-text')).not.toBeNull();
  expect(paragraph.querySelectorAll('.word')).toHaveLength(2);
});
