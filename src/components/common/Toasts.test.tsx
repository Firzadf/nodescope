// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toasts, type Toast } from './Toasts';

describe('Toasts', () => {
  it('renders messages and dismisses one on click', () => {
    const onDismiss = vi.fn();
    const toasts: Toast[] = [
      { id: 1, message: 'Health snapshot saved' },
      { id: 2, message: 'Report exported' },
    ];
    render(<Toasts toasts={toasts} onDismiss={onDismiss} />);
    expect(screen.getByText('Health snapshot saved')).toBeInTheDocument();
    expect(screen.getByText('Report exported')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Dismiss notification')[0]);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<Toasts toasts={[]} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
