/* The hint is canvases in list items with no roles to query by, so these tests read the DOM directly. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { render, screen } from '@testing-library/react';
import CityHint from './CityHint';

const realMatchMedia = window.matchMedia;
beforeEach(() => {
  // jsdom has no canvas: say so quietly instead of logging "not implemented".
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  jest.restoreAllMocks();
  window.matchMedia = realMatchMedia;
});

const titles = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('li')).map((li) => (li.querySelector('div') as HTMLElement).firstChild?.textContent);

describe('CityHint', () => {
  it('renders four vignettes with mouse wording by default', () => {
    const { container } = render(<CityHint />);
    expect(container.querySelectorAll('li')).toHaveLength(4);
    expect(container.querySelectorAll('li canvas')).toHaveLength(4);
    expect(titles(container)).toEqual(['Hover', 'Click', 'Taller', 'Lit windows']);
    expect(screen.getByText('opens it on GitHub')).toBeTruthy();
  });

  it('uses Tap and Tap again on a device that cannot hover, and keeps the other two', () => {
    window.matchMedia = ((query: string) => ({ matches: query === '(hover: none)' })) as unknown as typeof window.matchMedia;
    const { container } = render(<CityHint />);
    expect(titles(container)).toEqual(['Tap', 'Tap again', 'Taller', 'Lit windows']);
    expect(screen.getByText('names the repo')).toBeTruthy();
    expect(screen.getByText('pushed lately')).toBeTruthy();
  });

  it('draws one still frame into each canvas under reduced motion, and does not keep animating', () => {
    const ctxs: Array<{ clearRect: jest.Mock; fillRect: jest.Mock; fillStyle: string }> = [];
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockImplementation((() => {
      const ctx = { clearRect: jest.fn(), fillRect: jest.fn(), fillStyle: '' };
      ctxs.push(ctx);
      return ctx;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    window.matchMedia = ((query: string) => ({ matches: query.indexOf('reduce') >= 0 })) as unknown as typeof window.matchMedia;
    const frames: FrameRequestCallback[] = [];
    const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    render(<CityHint />);
    expect(frames).toHaveLength(1);
    frames[0](5000);
    raf.mockRestore();
    expect(ctxs).toHaveLength(4);
    ctxs.forEach((ctx) => {
      expect(ctx.clearRect).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(10);
    });
    // reduced motion: the frame did not ask for another one
    expect(frames).toHaveLength(1);
  });
});
