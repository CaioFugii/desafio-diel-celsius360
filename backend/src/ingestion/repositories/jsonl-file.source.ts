import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import {
  SourceLine,
  TelemetrySource,
} from '../interfaces/telemetry-source.interface';

export class JsonlFileSource implements TelemetrySource {
  readonly name: string;

  constructor(private readonly path: string) {
    this.name = basename(path);
  }

  async *read(afterLine: number): AsyncIterable<SourceLine> {
    const lines = createInterface({
      input: createReadStream(this.path, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    let lineNo = 0;
    for await (const text of lines) {
      lineNo += 1;
      if (lineNo <= afterLine || text.trim() === '') continue;
      yield { lineNo, text };
    }
  }
}
