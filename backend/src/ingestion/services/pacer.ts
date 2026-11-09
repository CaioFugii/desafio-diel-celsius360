import { Clock, Pacer } from '../interfaces/pacer.interface';

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class UnthrottledPacer implements Pacer {
  start(): void {}

  async throttle(): Promise<void> {}
}

/** Keeps the cumulative throughput at `perSecond`, absorbing time spent processing. */
export class RatePacer implements Pacer {
  private startedAt = 0;
  private total = 0;

  constructor(
    private readonly perSecond: number,
    private readonly clock: Clock = systemClock,
  ) {
    if (!(perSecond > 0)) throw new Error('rate must be positive');
  }

  start(): void {
    this.startedAt = this.clock.now();
    this.total = 0;
  }

  async throttle(processed: number): Promise<void> {
    this.total += processed;
    const dueAt = this.startedAt + (this.total / this.perSecond) * 1_000;
    const wait = dueAt - this.clock.now();
    if (wait > 0) await this.clock.sleep(wait);
  }
}

export function pacerFor(packetsPerSecond: number, clock?: Clock): Pacer {
  return packetsPerSecond > 0
    ? new RatePacer(packetsPerSecond, clock)
    : new UnthrottledPacer();
}
