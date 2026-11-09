export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** Controls how fast packets are replayed, simulating continuous arrival. */
export interface Pacer {
  start(): void;
  throttle(processed: number): Promise<void>;
}
