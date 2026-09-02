/** @jest-environment jsdom */
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { useCountdown } from './useCountdown';

function TestHarness({
  duration,
  activeKey,
  onExpire,
}: {
  duration: number;
  activeKey: string | null;
  onExpire?: () => void;
}) {
  const value = useCountdown(duration, activeKey, onExpire);
  return <div data-testid="value">{value}</div>;
}

describe('useCountdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts at the given duration and counts down every second', () => {
    render(<TestHarness duration={15} activeKey="card-1" />);
    expect(screen.getByTestId('value')).toHaveTextContent('15');

    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('value')).toHaveTextContent('14');
  });

  it('calls onExpire exactly once when it reaches zero, and stops there', () => {
    const onExpire = jest.fn();
    render(<TestHarness duration={2} activeKey="card-1" onExpire={onExpire} />);

    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByTestId('value')).toHaveTextContent('0');
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('value')).toHaveTextContent('0');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('resets to the full duration when the active key changes', () => {
    const { rerender } = render(<TestHarness duration={15} activeKey="card-1" />);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('value')).toHaveTextContent('10');

    rerender(<TestHarness duration={15} activeKey="card-2" />);
    expect(screen.getByTestId('value')).toHaveTextContent('15');
  });

  it('does not tick while the active key is null', () => {
    render(<TestHarness duration={15} activeKey={null} />);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('value')).toHaveTextContent('15');
  });
});
