import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PgIngestionNotifier } from '../../../../src/ingestion/repositories/pg-ingestion.notifier';
import { INGESTION_PROGRESS_CHANNEL } from '../../../../src/shared/events/ingestion-progress';

describe('PgIngestionNotifier', () => {
  const query = jest.fn();
  const notifier = new PgIngestionNotifier({ query } as unknown as Pool);
  const progress = {
    source: 'telemetrias.jsonl',
    lastLine: 500,
    referenceTime: new Date('2026-02-10T12:00:00Z'),
    zoneIds: ['AMB-001'],
  };

  beforeEach(() => query.mockReset());

  it('publishes the progress on the ingestion channel', async () => {
    query.mockResolvedValue({ rows: [] });

    await notifier.batchCommitted(progress);

    expect(query).toHaveBeenCalledWith('SELECT pg_notify($1, $2)', [
      INGESTION_PROGRESS_CHANNEL,
      JSON.stringify({
        source: 'telemetrias.jsonl',
        lastLine: 500,
        referenceTime: '2026-02-10T12:00:00.000Z',
        zoneIds: ['AMB-001'],
      }),
    ]);
  });

  it('does not interrupt the ingestion when the notification fails', async () => {
    query.mockRejectedValue(new Error('connection reset'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(notifier.batchCommitted(progress)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('connection reset'),
    );
    warn.mockRestore();
  });
});
