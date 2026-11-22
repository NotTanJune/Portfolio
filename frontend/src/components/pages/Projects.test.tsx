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

  it('puts one lot on each of the 18 cards: buildings for repos in the city, parks for the rest', () => {
    const { container } = render(<Projects />);
    expect(container.querySelectorAll('[data-project-card]')).toHaveLength(18);
    expect(container.querySelectorAll('.project-lot')).toHaveLength(18);
    expect(lotIn(cardOf('Locator (lctr)')).dataset.kind).toBe('building');
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
    expect(buildings.length + parks.length).toBe(18);
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
    // Cards are keyed by index: the second card is Locator under All and Every Round under iOS App.
    const secondBefore = container.querySelectorAll('[data-project-card]')[1] as HTMLElement;
    expect(secondBefore.querySelector('h3')!.textContent).toBe('Locator (lctr)');
    expect(lotIn(secondBefore).dataset.kind).toBe('building');
    expect(secondBefore.querySelector('.project-lot__cap')).not.toBeNull();
    const heightBefore = lotIn(secondBefore).style.height;

    fireEvent.click(screen.getByRole('button', { name: 'iOS App' }));

    const secondAfter = container.querySelectorAll('[data-project-card]')[1] as HTMLElement;
    expect(secondAfter).toBe(secondBefore);
    expect(secondAfter.querySelector('h3')!.textContent).toBe('Every Round');
    expect(lotIn(secondAfter).dataset.kind).toBe('park');
    expect(secondAfter.querySelector('.project-lot__cap')).toBeNull();
    expect(lotIn(secondAfter).style.height).not.toBe(heightBefore);
    expect(container.querySelectorAll('.project-lot')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(container.querySelectorAll('.project-lot')).toHaveLength(18);
    expect(lotIn(cardOf('Locator (lctr)')).dataset.kind).toBe('building');
  });
});
