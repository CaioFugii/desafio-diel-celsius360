import { LoggerService } from '@nestjs/common';
import { parsePacket } from '../telemetry/domain/telemetry-packet';
import { latestPacketAt } from './device-state';
import { IngestionBatch, IngestionStore } from './ingestion.store';
import { PacketEnricher } from './packet-enricher';
import { Pacer } from './pacer';
import { SourceLine, TelemetrySource } from './telemetry-source';

export interface IngestionOptions {
  batchSize: number;
  /** Ignore the checkpoint and replay the whole source (safe: writes are idempotent). */
  fromStart: boolean;
  /** Log progress every N processed lines. */
  progressEvery: number;
}

export interface IngestionReport {
  source: string;
  resumedAfterLine: number;
  lastLine: number;
  lines: number;
  packets: number;
  invalidLines: number;
  unknownDevicePackets: number;
  samples: number;
  rejectedSamples: number;
  referenceTime: Date | null;
  aborted: boolean;
}

export class IngestionRunner {
  constructor(
    private readonly source: TelemetrySource,
    private readonly store: IngestionStore,
    private readonly enricher: PacketEnricher,
    private readonly pacer: Pacer,
    private readonly options: IngestionOptions,
    private readonly logger: Pick<LoggerService, 'log'>,
  ) {
    if (options.batchSize < 1) throw new Error('batchSize must be at least 1');
  }

  async run(signal?: AbortSignal): Promise<IngestionReport> {
    const checkpoint = await this.store.checkpoint(this.source.name);
    const resumedAfterLine = this.options.fromStart
      ? 0
      : (checkpoint?.lastLine ?? 0);
    const report: IngestionReport = {
      source: this.source.name,
      resumedAfterLine,
      lastLine: resumedAfterLine,
      lines: 0,
      packets: 0,
      invalidLines: 0,
      unknownDevicePackets: 0,
      samples: 0,
      rejectedSamples: 0,
      referenceTime: checkpoint?.referenceTime ?? null,
      aborted: false,
    };

    await this.store.markStarted(this.source.name);
    this.logger.log(
      `ingesting ${this.source.name} after line ${resumedAfterLine}`,
    );
    this.pacer.start();

    let pending: SourceLine[] = [];
    let nextProgress = this.options.progressEvery;
    for await (const line of this.source.read(resumedAfterLine)) {
      pending.push(line);
      if (pending.length < this.options.batchSize) continue;
      await this.flush(pending, report);
      pending = [];
      if (report.lines >= nextProgress) {
        this.logProgress(report);
        nextProgress += this.options.progressEvery;
      }
      if (signal?.aborted) {
        report.aborted = true;
        break;
      }
    }
    if (!report.aborted && pending.length > 0)
      await this.flush(pending, report);

    if (!report.aborted) await this.store.markCompleted(this.source.name);
    this.logProgress(report);
    return report;
  }

  private async flush(
    lines: SourceLine[],
    report: IngestionReport,
  ): Promise<void> {
    const batch = this.buildBatch(lines);
    await this.store.persist(batch);

    report.lines += lines.length;
    report.lastLine = batch.lastLine;
    report.packets += batch.packets.length;
    report.invalidLines += batch.invalidLines.length;
    for (const { enriched } of batch.packets) {
      if (enriched.zoneId === null) report.unknownDevicePackets += 1;
      report.samples += enriched.samples.length;
      report.rejectedSamples += enriched.rejected.length;
    }
    const latest = latestPacketAt(batch.packets);
    if (latest && (!report.referenceTime || latest > report.referenceTime)) {
      report.referenceTime = latest;
    }
    await this.pacer.throttle(lines.length);
  }

  private buildBatch(lines: SourceLine[]): IngestionBatch {
    const batch: IngestionBatch = {
      source: this.source.name,
      lastLine: lines[lines.length - 1].lineNo,
      packets: [],
      invalidLines: [],
    };
    for (const { lineNo, text } of lines) {
      const parsed = parsePacket(text);
      if (parsed.ok) {
        batch.packets.push({
          lineNo,
          text,
          enriched: this.enricher.enrich(parsed.packet),
        });
      } else {
        batch.invalidLines.push({ lineNo, text, reason: parsed.reason });
      }
    }
    return batch;
  }

  private logProgress(r: IngestionReport): void {
    this.logger.log(
      `line ${r.lastLine}: ${r.packets} packets, ${r.samples} samples, ` +
        `${r.rejectedSamples} rejected readings, ${r.invalidLines} invalid lines, ` +
        `${r.unknownDevicePackets} from unknown devices; now=${r.referenceTime?.toISOString() ?? '-'}`,
    );
  }
}
