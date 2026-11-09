import {
  Clock,
  RatePacer,
  UnthrottledPacer,
  pacerFor,
  systemClock,
} from './pacer';

class FakeClock implements Clock {
  current = 0;
  sleeps: number[] = [];

  now(): number {
    return this.current;
  }

  async sleep(ms: number): Promise<void> {
    this.sleeps.push(ms);
    this.current += ms;
  }
}

describe('RatePacer', () => {
  it('sleeps until the cumulative rate is honoured', async () => {
    const clock = new FakeClock();
    const pacer = new RatePacer(100, clock);
    pacer.start();

    await pacer.throttle(50);
    clock.current += 200;
    await pacer.throttle(50);

    expect(clock.sleeps).toEqual([500, 300]);
  });

  it('does not sleep when processing is already slower than the rate', async () => {
    const clock = new FakeClock();
    const pacer = new RatePacer(100, clock);
    pacer.start();

    clock.current += 2_000;
    await pacer.throttle(100);

    expect(clock.sleeps).toEqual([]);
  });

  it('restarts the accounting on start()', async () => {
    const clock = new FakeClock();
    const pacer = new RatePacer(10, clock);
    pacer.start();
    await pacer.throttle(10);

    pacer.start();
    await pacer.throttle(5);

    expect(clock.sleeps).toEqual([1_000, 500]);
  });

  it('rejects non-positive rates', () => {
    expect(() => new RatePacer(0)).toThrow(/positive/);
  });
});

describe('systemClock', () => {
  afterEach(() => jest.useRealTimers());

  it('reads the wall clock and sleeps with a timer', async () => {
    jest.useFakeTimers({ now: 1_000 });
    const sleeping = systemClock.sleep(500);

    jest.advanceTimersByTime(500);

    await expect(sleeping).resolves.toBeUndefined();
    expect(systemClock.now()).toBe(1_500);
  });
});

describe('pacerFor', () => {
  it('disables throttling when the rate is zero', async () => {
    const pacer = pacerFor(0);
    pacer.start();

    expect(pacer).toBeInstanceOf(UnthrottledPacer);
    await expect(pacer.throttle(1_000_000)).resolves.toBeUndefined();
  });

  it('uses a rate pacer otherwise', () => {
    expect(pacerFor(10)).toBeInstanceOf(RatePacer);
  });
});
