import React from 'react';
import { render } from '@testing-library/react';
import { EmailIcon } from './components/Icons';

test('renders shared icon components', () => {
  const { container } = render(<EmailIcon />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});
