import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EmailIcon } from './components/Icons';
import { Navbar } from './App';

test('renders shared icon components', () => {
  const { container } = render(<EmailIcon />);
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  expect(container.querySelector('svg')).toBeInTheDocument();
});

describe('mobile navigation menu', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = 500;
    const observerStub = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (global as any).ResizeObserver = observerStub;
    (global as any).IntersectionObserver = observerStub;
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
    delete (global as any).ResizeObserver;
    delete (global as any).IntersectionObserver;
  });

  test('closed menu renders no dialog or menu links', () => {
    render(<Navbar />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument();
    // Stays mounted for the animation, but unreachable while closed.
    const hiddenMenu = screen.getByRole('dialog', { hidden: true });
    expect(hiddenMenu).toHaveAttribute('inert');
    expect(hiddenMenu).toHaveAttribute('aria-hidden', 'true');
  });

  test('open menu renders the dialog with links, marks the current page, and Escape closes it', async () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    const dialog = await screen.findByRole('dialog', { name: 'Navigation Menu' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute('inert');
    const trigger = screen.getByRole('button', { name: 'Close menu', hidden: true, expanded: true });
    expect(trigger).toHaveAttribute('aria-controls', dialog.id);

    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    const menu = within(dialog);
    expect(menu.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(menu.getByRole('link', { name: 'Projects' })).not.toHaveAttribute('aria-current');
    expect(menu.getByRole('link', { name: 'Resume' })).toBeInTheDocument();
    expect(menu.getByRole('link', { name: 'Contact' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape', code: 'Escape' });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
    expect(dialog).toHaveAttribute('inert');
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus());
  });

  test('close button closes the menu', async () => {
    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('dialog');
    const closeButtons = screen.getAllByRole('button', { name: 'Close menu' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
  });
});
