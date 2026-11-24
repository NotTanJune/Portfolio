import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

jest.mock('./utils/useAnimationRefresh', () => ({
  useAnimationRefresh: () => undefined,
}));

jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    Routes: () => null,
    Route: () => null,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement('a', { href: to, ...props }, children),
    useLocation: () => ({ pathname: '/' }),
  };
}, { virtual: true });
