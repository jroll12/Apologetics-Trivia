import { getTimerColor } from './timerColor';

describe('getTimerColor', () => {
  it('is white above 5 seconds remaining', () => {
    expect(getTimerColor(15)).toBe('var(--color-white)');
    expect(getTimerColor(6)).toBe('var(--color-white)');
  });

  it('is the warning color at 5 seconds or fewer', () => {
    expect(getTimerColor(5)).toBe('var(--color-warning)');
    expect(getTimerColor(4)).toBe('var(--color-warning)');
  });

  it('is the error color at 3 seconds or fewer', () => {
    expect(getTimerColor(3)).toBe('var(--color-error)');
    expect(getTimerColor(0)).toBe('var(--color-error)');
  });
});
