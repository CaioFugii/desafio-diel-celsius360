export interface SourceLine {
  /** 1-based position in the source, used as checkpoint and dedupe key. */
  lineNo: number;
  text: string;
}

export interface TelemetrySource {
  readonly name: string;
  /** Yields lines in arrival order, skipping the first `afterLine` ones. */
  read(afterLine: number): AsyncIterable<SourceLine>;
}
