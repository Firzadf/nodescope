// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage';

afterEach(() => cleanup());

describe('NotFoundPage', () => {
  it('names the miss and points back to real routes', () => {
    const { container } = render(<NotFoundPage />);
    const scope = within(container);
    expect(scope.getByText('404')).toBeTruthy();
    expect(scope.getByRole('link', { name: 'Back to landing' })).toHaveAttribute('href', '/');
    expect(scope.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app');
    expect(scope.getByRole('link', { name: '60-second judges path' })).toHaveAttribute('href', '/judges');
  });
});
