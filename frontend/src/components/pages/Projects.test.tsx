/* Lots are canvases inside styled divs with no roles to query by, so the lot tests read the DOM directly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
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
  // jsdom has no canvas: say so quietly instead of logging "not implemented" for every card lot.
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('filter includes projects with multiple categories', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'CLI Tool' }));

  expect(screen.getByRole('heading', { name: 'Locator (lctr)' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'DevDéx' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Anglerfish' })).not.toBeInTheDocument();
});

test('every filter button reports its pressed state and only the active one is pressed', () => {
  render(<Projects />);

  expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CLI Tool', pressed: false })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'CLI Tool' }));

  expect(screen.getByRole('button', { name: 'CLI Tool', pressed: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'All', pressed: false })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
});

test('LLM filter shows the Social Media AI Detector', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'LLM' }));

  expect(screen.getByRole('heading', { name: 'Social Media AI Detector' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Kelpie' })).not.toBeInTheDocument();
});

test('icon-only links carry accessible names that match their target', () => {
  render(<Projects />);

  expect(screen.getByRole('link', { name: 'Kelpie live site' })).toHaveAttribute('href', 'https://kelpie.site');
  expect(screen.getByRole('link', { name: 'Harbour source code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/NotTanJune/Harbour'
  );
  expect(screen.getByRole('link', { name: 'Harbour live demo' })).toHaveAttribute(
    'href',
    'https://nottanjune.github.io/Harbour/'
  );
});

test('macOS App filter shows Murmur alone, and iOS App includes it', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'macOS App' }));
  expect(screen.getByRole('heading', { name: 'Murmur' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Kelpie' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));
  expect(screen.getByRole('heading', { name: 'Murmur' })).toBeInTheDocument();
});

test('iOS App filter shows Kelpie and Every Round', () => {
  render(<Projects />);

  fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));

  expect(screen.getByRole('heading', { name: 'Kelpie' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Every Round' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Locator (lctr)' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kelpie announcement on X' })).toHaveAttribute('href', 'https://x.com/nottanjune/status/2111028384327458821');
});

describe('the building or park on every card', () => {
  const cardOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[data-project-card]') as HTMLElement;
  const lotIn = (card: Element) => card.querySelector('.project-lot') as HTMLElement;

  it('puts one lot on each of the 19 cards: buildings for repos in the city, parks for the rest', () => {
    const { container } = render(<Projects />);
    expect(container.querySelectorAll('[data-project-card]')).toHaveLength(19);
    expect(container.querySelectorAll('.project-lot')).toHaveLength(19);
    expect(lotIn(cardOf('Locator (lctr)')).dataset.kind).toBe('building');
    expect(lotIn(cardOf('Murmur')).dataset.kind).toBe('building');
    expect(lotIn(cardOf('Kelpie')).dataset.kind).toBe('park');
    expect(lotIn(cardOf('Every Round')).dataset.kind).toBe('park');
    // a building brings a caption, a park does not
    expect(cardOf('Locator (lctr)').querySelector('.project-lot__cap')).not.toBeNull();
    expect(cardOf('Kelpie').querySelector('.project-lot__cap')).toBeNull();
    // the lot is the first thing in the footer row, ahead of the spacer and the link buttons
    const footer = lotIn(cardOf('Locator (lctr)')).parentElement as HTMLElement;
    expect(footer.firstElementChild).toBe(lotIn(cardOf('Locator (lctr)')));
    expect(footer.style.alignItems).toBe('flex-end');
  });

  it('hands the parks out in order so no two park cards look alike', () => {
    const { container } = render(<Projects />);
    const lots = Array.from(container.querySelectorAll('.project-lot')) as HTMLElement[];
    const parks = lots.filter((l) => l.dataset.kind === 'park').map((l) => l.dataset.park);
    const buildings = lots.filter((l) => l.dataset.kind === 'building');
    expect(parks.length).toBeGreaterThanOrEqual(2);
    expect(buildings.length + parks.length).toBe(19);
    expect(new Set(parks).size).toBe(parks.length);
    // Kelpie is the first project with no building, so it gets the first park
    expect(lotIn(cardOf('Kelpie')).dataset.park).toBe('0');
    expect(parks).toEqual(parks.slice().sort());
  });

  it('keeps a card\'s park when the filter changes', () => {
    render(<Projects />);
    const kelpiePark = lotIn(cardOf('Kelpie')).dataset.park;
    const everyRoundPark = lotIn(cardOf('Every Round')).dataset.park;
    expect(kelpiePark).not.toBe(everyRoundPark);

    fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));

    expect(lotIn(cardOf('Kelpie')).dataset.park).toBe(kelpiePark);
    expect(lotIn(cardOf('Every Round')).dataset.park).toBe(everyRoundPark);
  });

  it('re-points a card\'s lot when the filter hands that card another project', () => {
    const { container } = render(<Projects />);
    // Cards are keyed by index: the third card is Locator under All and Every Round under iOS App.
    const thirdBefore = container.querySelectorAll('[data-project-card]')[2] as HTMLElement;
    expect(thirdBefore.querySelector('h3')!.textContent).toBe('Locator (lctr)');
    expect(lotIn(thirdBefore).dataset.kind).toBe('building');
    expect(thirdBefore.querySelector('.project-lot__cap')).not.toBeNull();
    const heightBefore = lotIn(thirdBefore).style.height;

    fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));

    const thirdAfter = container.querySelectorAll('[data-project-card]')[2] as HTMLElement;
    expect(thirdAfter).toBe(thirdBefore);
    expect(thirdAfter.querySelector('h3')!.textContent).toBe('Every Round');
    expect(lotIn(thirdAfter).dataset.kind).toBe('park');
    expect(thirdAfter.querySelector('.project-lot__cap')).toBeNull();
    expect(lotIn(thirdAfter).style.height).not.toBe(heightBefore);
    expect(container.querySelectorAll('.project-lot')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(container.querySelectorAll('.project-lot')).toHaveLength(19);
    expect(lotIn(cardOf('Locator (lctr)')).dataset.kind).toBe('building');
  });
});
