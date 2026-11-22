/* A lot is a canvas inside a styled div with no roles to query by, so these tests read the DOM directly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { fireEvent, render } from '@testing-library/react';
import ProjectLot from './ProjectLot';
import { formatAge, daysSince } from './format';
import * as lotStage from './lotStage';
import { lotLayout, lotTargetFor, LotHandle } from './lotStage';
import { PARK_COUNT } from './parks';
import { NOW, snapshotRepos } from './test-helpers';

const repos = snapshotRepos();
const locator = repos.filter((r) => r.name.toLowerCase() === 'locator')[0];

beforeEach(() => {
  // jsdom has no canvas: say so quietly instead of logging "not implemented".
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => {
  jest.restoreAllMocks();
});

const lot = (container: HTMLElement) => container.querySelector('.project-lot') as HTMLElement;
const cap = (container: HTMLElement) => container.querySelector('.project-lot__cap') as HTMLElement | null;

describe('ProjectLot in jsdom (nothing is drawn)', () => {
  it('shows a building with a caption for a repo in the city', () => {
    expect(locator).toBeDefined();
    const { container } = render(<ProjectLot repos={repos} repoName="locator" park={0} seed="Locator (lctr)" />);
    expect(lot(container).dataset.kind).toBe('building');
    expect(lot(container).hasAttribute('data-park')).toBe(false);
    expect(lot(container).dataset.renderer).toBe('none');
    const text = (cap(container) as HTMLElement).textContent;
    expect(text).toContain('Rust');
    expect(text).toBe('Rustpushed ' + formatAge(daysSince(locator.pushedAt, NOW)));
  });

  it('shows a park, and no caption, when there is no building', () => {
    const { container } = render(<ProjectLot repos={repos} repoName={null} park={3} seed="Kelpie" />);
    expect(lot(container).dataset.kind).toBe('park');
    expect(lot(container).dataset.park).toBe('3');
    expect(cap(container)).toBeNull();
  });

  it('also shows a park when the repo name is not in the city', () => {
    const { container } = render(<ProjectLot repos={repos} repoName="not-a-repo-of-mine" park={PARK_COUNT + 2} seed="x" />);
    expect(lot(container).dataset.kind).toBe('park');
    expect(lot(container).dataset.park).toBe('2');
  });

  it('finds the building whatever the case of the repo name', () => {
    const { container } = render(<ProjectLot repos={repos} repoName="LOCATOR" park={0} seed="Locator (lctr)" />);
    expect(lot(container).dataset.kind).toBe('building');
    expect((cap(container) as HTMLElement).textContent).toContain('Rust');
  });

  it('follows its props when the same instance is handed another project', () => {
    const { container, rerender } = render(<ProjectLot repos={repos} repoName="locator" park={0} seed="Locator (lctr)" />);
    const building = lotLayout(repos, lotTargetFor(repos, 'locator', 0));
    expect(lot(container).style.height).toBe(building.height + 'px');
    expect(cap(container)).not.toBeNull();

    rerender(<ProjectLot repos={repos} repoName={null} park={4} seed="Kelpie" />);
    const park = lotLayout(repos, { kind: 'park', park: 4 });
    expect(lot(container).dataset.kind).toBe('park');
    expect(lot(container).dataset.park).toBe('4');
    expect(cap(container)).toBeNull();
    expect(lot(container).style.height).toBe(park.height + 'px');
    expect(park.height).not.toBe(building.height);

    rerender(<ProjectLot repos={repos} repoName="locator" park={0} seed="Locator (lctr)" />);
    expect(lot(container).dataset.kind).toBe('building');
    expect(lot(container).hasAttribute('data-park')).toBe(false);
    expect(cap(container)).not.toBeNull();
  });

  it('sizes the lot and its canvas from the layout, so the footer has its final height on first paint', () => {
    const { container } = render(<ProjectLot repos={repos} repoName="locator" park={0} seed="s" />);
    const layout = lotLayout(repos, lotTargetFor(repos, 'locator', 0));
    const canvas = container.querySelector('.project-lot__canvas') as HTMLCanvasElement;
    expect(layout.width).toBe(60);
    expect(lot(container).style.width).toBe('60px');
    expect(canvas.style.width).toBe('60px');
    expect(canvas.style.height).toBe(layout.canvasHeight + 'px');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ProjectLot and the shared stage', () => {
  const makeHandle = () => ({ setTarget: jest.fn(), setHover: jest.fn(), release: jest.fn() });

  it('joins the stage once, re-targets on new props, follows the card hover, and releases on unmount', () => {
    const handle = makeHandle();
    const acquire = jest.spyOn(lotStage, 'acquireLot').mockReturnValue(handle as LotHandle);
    jest.spyOn(lotStage, 'lotRendererKind').mockReturnValue('webgl2');
    const card = document.createElement('div');
    card.setAttribute('data-project-card', '');
    document.body.appendChild(card);
    const { container, rerender, unmount } = render(
      <ProjectLot repos={repos} repoName="locator" park={0} seed="Locator (lctr)" />,
      { container: card },
    );

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(acquire.mock.calls[0][0]).toBe(container.querySelector('canvas'));
    expect(acquire.mock.calls[0][1]).toBe(repos);
    expect(acquire.mock.calls[0][2]).toEqual(lotTargetFor(repos, 'locator', 0));
    expect(acquire.mock.calls[0][3]).toBe('Locator (lctr)');
    expect(lot(container).dataset.renderer).toBe('webgl2');

    // The card's own hover drives the lot's spin speed.
    fireEvent.mouseEnter(card);
    expect(handle.setHover).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(card);
    expect(handle.setHover).toHaveBeenLastCalledWith(false);

    // A different project in the same instance re-targets; it does not join the stage again.
    handle.setTarget.mockClear();
    rerender(<ProjectLot repos={repos} repoName={null} park={2} seed="Kelpie" />);
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(handle.setTarget).toHaveBeenLastCalledWith({ kind: 'park', park: 2 });

    // Unchanged props do not re-target.
    handle.setTarget.mockClear();
    rerender(<ProjectLot repos={repos} repoName={null} park={2} seed="Kelpie" />);
    expect(handle.setTarget).not.toHaveBeenCalled();

    handle.setHover.mockClear();
    unmount();
    expect(handle.release).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(card);
    expect(handle.setHover).not.toHaveBeenCalled();
    document.body.removeChild(card);
  });
});
