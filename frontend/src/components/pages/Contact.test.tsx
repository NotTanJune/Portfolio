import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Contact from './Contact';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('../../App', () => {
  const React = require('react');
  return {
    colors: {
      mainBg: '#ffffff',
      cardBg: '#ffffff',
      lightBg: '#ffffff',
      techBg: '#f5f5f5',
      primaryText: '#111111',
      secondaryText: '#555555',
      accentText: '#333333',
      accentHover: '#eeeeee',
      borderColor: '#dddddd',
      buttonPrimary: '#111111',
      buttonHover: '#222222',
      mutedText: '#999999',
      white: '#ffffff',
    },
    ThemeContext: React.createContext({ theme: 'light' }),
    AnimatedSection: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// The widget hands out a single-use token; reset() issues a fresh one like the real widget does.
jest.mock('../Turnstile', () => {
  const React = require('react');
  const Turnstile = React.forwardRef(({ onToken }: { onToken: (token: string | null) => void }, ref: any) => {
    React.useImperativeHandle(ref, () => ({ reset: () => onToken('fresh-token') }), [onToken]);
    React.useEffect(() => {
      onToken('token');
    }, [onToken]);
    return null;
  });
  return { __esModule: true, default: Turnstile, TURNSTILE_SITE_KEY: 'test-key' };
});

const post = axios.post as jest.Mock;
const WAIT_MESSAGE = /wait at least 30 seconds/i;

let now = 1_000_000;

beforeEach(() => {
  window.scrollTo = jest.fn();
  post.mockReset();
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { name: 'name', value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { name: 'subject', value: 'Hello' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { name: 'message', value: 'Hi there' } });
  fireEvent.click(screen.getByRole('button', { name: /send message/i }));
}

test('inputs carry the backend length limits', () => {
  render(<Contact />);
  expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '100');
  expect(screen.getByLabelText('Subject')).toHaveAttribute('maxlength', '200');
  expect(screen.getByLabelText('Message')).toHaveAttribute('maxlength', '2000');
});

test('message counter is described by the textarea and tracks length without a live region', () => {
  render(<Contact />);
  const textarea = screen.getByLabelText('Message');
  const counterId = textarea.getAttribute('aria-describedby');
  expect(counterId).toBeTruthy();
  // eslint-disable-next-line testing-library/no-node-access
  const counter = document.getElementById(counterId as string) as HTMLElement;
  expect(counter).toHaveTextContent('0 / 2000');
  expect(counter).not.toHaveAttribute('aria-live');

  fireEvent.change(textarea, { target: { name: 'message', value: 'hello' } });
  expect(counter).toHaveTextContent('5 / 2000');
});

test('a failed submit does not trigger the 30s cooldown on retry', async () => {
  post.mockRejectedValueOnce({ response: { data: { message: 'Message too long' } } });
  post.mockResolvedValueOnce({ data: { message: 'Sent!' } });

  render(<Contact />);

  now += 4000;
  await act(async () => {
    fillAndSubmit();
  });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Message too long'));
  expect(post).toHaveBeenCalledTimes(1);

  now += 1000;
  await act(async () => {
    fillAndSubmit();
  });
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(WAIT_MESSAGE)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sent!'));
});

test('a successful submit still starts the 30s cooldown', async () => {
  post.mockResolvedValue({ data: { message: 'Sent!' } });

  render(<Contact />);

  now += 4000;
  await act(async () => {
    fillAndSubmit();
  });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sent!'));

  now += 1000;
  await act(async () => {
    fillAndSubmit();
  });
  expect(screen.getByRole('alert')).toHaveTextContent(WAIT_MESSAGE);
  expect(post).toHaveBeenCalledTimes(1);
});
