/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CountdownRing } from './CountdownRing';

describe('CountdownRing', () => {
  it('labels itself with the seconds remaining', () => {
    render(<CountdownRing secondsRemaining={12} totalSeconds={15} />);
    expect(screen.getByRole('img', { name: '12 seconds remaining' })).toBeInTheDocument();
  });

  it('clamps a negative or over-total value into range', () => {
    render(<CountdownRing secondsRemaining={-4} totalSeconds={15} />);
    expect(screen.getByRole('img', { name: '0 seconds remaining' })).toBeInTheDocument();
  });

  it('turns the progress stroke to the warning color at 5 seconds', () => {
    const { container } = render(<CountdownRing secondsRemaining={5} totalSeconds={15} />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle).toHaveAttribute('stroke', 'var(--color-warning)');
  });

  it('turns the progress stroke to the error color at 3 seconds', () => {
    const { container } = render(<CountdownRing secondsRemaining={3} totalSeconds={15} />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle).toHaveAttribute('stroke', 'var(--color-error)');
  });
});
