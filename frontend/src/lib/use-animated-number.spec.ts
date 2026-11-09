import { act, renderHook } from '@testing-library/react';
import { useAnimatedNumber } from './use-animated-number';

function setup(target: number | null = 20, scope = 'a') {
  return renderHook(
    ({ target, scope }: { target: number | null; scope: string }) =>
      useAnimatedNumber(target, scope, 400),
    { initialProps: { target, scope } },
  );
}

describe('useAnimatedNumber', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    delete (window as Partial<Window>).matchMedia;
  });

  it('starts at the target', () => {
    expect(setup().result.current).toBe(20);
  });

  it('glides from the previous value to the new one', () => {
    const { result, rerender } = setup();

    rerender({ target: 22, scope: 'a' });
    expect(result.current).toBe(20);
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBeGreaterThan(20);
    expect(result.current).toBeLessThan(22);
    act(() => jest.advanceTimersByTime(300));

    expect(result.current).toBe(22);
  });

  it('continues from the value on screen when the target changes mid-way', () => {
    const { result, rerender } = setup();
    rerender({ target: 30, scope: 'a' });
    act(() => jest.advanceTimersByTime(200));
    const midway = result.current!;

    rerender({ target: 10, scope: 'a' });
    act(() => jest.advanceTimersByTime(100));

    expect(result.current).toBeLessThan(midway);
    act(() => jest.advanceTimersByTime(500));
    expect(result.current).toBe(10);
  });

  it('jumps when the scope changes or there is nothing to glide from', () => {
    const { result, rerender } = setup();

    rerender({ target: 25, scope: 'b' });
    expect(result.current).toBe(25);
    rerender({ target: null, scope: 'b' });
    expect(result.current).toBeNull();
    rerender({ target: 18, scope: 'b' });
    expect(result.current).toBe(18);
  });

  it('jumps when the user prefers reduced motion', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { result, rerender } = setup();

    rerender({ target: 22, scope: 'a' });
    act(() => jest.advanceTimersByTime(0));

    expect(result.current).toBe(22);
  });

  it('stops animating on unmount', () => {
    const cancel = jest.spyOn(window, 'cancelAnimationFrame');
    const { rerender, unmount } = setup();
    rerender({ target: 22, scope: 'a' });

    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
