/* The live region and the root have no accessible name to query by, so these tests read the DOM directly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CircularCarousel from './CircularCarousel';

const items = [
  { src: '/a.webp', alt: 'First', title: 'First' },
  { src: '/b.webp', alt: 'Second', title: 'Second' },
  { src: '/c.webp', alt: 'Third', title: 'Third' },
];

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

const liveRegion = (container: HTMLElement) => container.querySelector('.circular-carousel__live') as HTMLElement;
const root = (container: HTMLElement) => container.querySelector('.circular-carousel') as HTMLElement;

test('live region is off while autoplay runs and polite once the user pauses', () => {
  const { container } = render(<CircularCarousel items={items} />);

  expect(liveRegion(container)).toHaveAttribute('aria-live', 'off');

  fireEvent.click(screen.getByRole('button', { name: 'Pause carousel' }));

  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');
});

test('pause button toggles its accessible name and stays paused', () => {
  const { container } = render(<CircularCarousel items={items} />);

  fireEvent.click(screen.getByRole('button', { name: 'Pause carousel' }));
  expect(screen.getByRole('button', { name: 'Play carousel' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Pause carousel' })).not.toBeInTheDocument();

  // Pointer leaving must not resume an explicit pause.
  fireEvent.pointerEnter(root(container), { pointerType: 'mouse' });
  fireEvent.pointerLeave(root(container), { pointerType: 'mouse' });
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');

  fireEvent.click(screen.getByRole('button', { name: 'Play carousel' }));
  expect(screen.getByRole('button', { name: 'Pause carousel' })).toBeInTheDocument();
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'off');
});

test('keyboard focus inside the carousel pauses announcements until focus leaves', () => {
  const { container } = render(<CircularCarousel items={items} />);

  act(() => root(container).focus());
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');

  act(() => root(container).blur());
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'off');
});

test('focus moving to the pause button keeps the carousel paused', () => {
  const { container } = render(<CircularCarousel items={items} />);
  const button = screen.getByRole('button', { name: 'Pause carousel' });

  act(() => root(container).focus());
  act(() => button.focus());
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');

  act(() => button.blur());
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'off');
});

test('a touch interaction pauses and releasing it resumes', () => {
  const { container } = render(<CircularCarousel items={items} />);

  fireEvent.pointerDown(root(container), { pointerId: 1, pointerType: 'touch', button: 0 });
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');

  fireEvent.pointerUp(root(container), { pointerId: 1, pointerType: 'touch' });
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'off');
});

test('manual keyboard navigation makes the live region polite', () => {
  const { container } = render(<CircularCarousel items={items} />);

  fireEvent.keyDown(root(container), { key: 'ArrowRight' });

  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');
});

test('Enter on the pause button toggles it without triggering the carousel item action', () => {
  const onItemClick = jest.fn();
  render(<CircularCarousel items={items} onItemClick={onItemClick} />);
  const button = screen.getByRole('button', { name: 'Pause carousel' });

  // The root handles Enter and Space for item activation, the button must be exempt.
  const notPrevented = fireEvent.keyDown(button, { key: 'Enter' });

  expect(notPrevented).toBe(true);
  expect(onItemClick).not.toHaveBeenCalled();
});

test('no pause button and a polite live region when autoplay is off', () => {
  const { container } = render(<CircularCarousel items={items} autoplay="off" />);

  expect(screen.queryByRole('button', { name: /carousel/i })).not.toBeInTheDocument();
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');
});

test('no pause button under prefers-reduced-motion', () => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;

  const { container } = render(<CircularCarousel items={items} />);

  expect(screen.queryByRole('button', { name: /carousel/i })).not.toBeInTheDocument();
  expect(liveRegion(container)).toHaveAttribute('aria-live', 'polite');
});
