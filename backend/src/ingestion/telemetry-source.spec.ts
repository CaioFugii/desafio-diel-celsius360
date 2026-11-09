import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonlFileSource, SourceLine } from './telemetry-source';

async function collect(
  iterable: AsyncIterable<SourceLine>,
): Promise<SourceLine[]> {
  const lines: SourceLine[] = [];
  for await (const line of iterable) lines.push(line);
  return lines;
}

describe('JsonlFileSource', () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'jsonl-'));
    file = join(dir, 'telemetrias.jsonl');
    writeFileSync(file, '{"a":1}\r\n{"a":2}\n\n{"a":3}\n');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('is named after the file', () => {
    expect(new JsonlFileSource(file).name).toBe('telemetrias.jsonl');
  });

  it('yields non-empty lines with their 1-based position', async () => {
    expect(await collect(new JsonlFileSource(file).read(0))).toEqual([
      { lineNo: 1, text: '{"a":1}' },
      { lineNo: 2, text: '{"a":2}' },
      { lineNo: 4, text: '{"a":3}' },
    ]);
  });

  it('resumes after a given line', async () => {
    expect(await collect(new JsonlFileSource(file).read(2))).toEqual([
      { lineNo: 4, text: '{"a":3}' },
    ]);
  });
});
