-- Raw data: append-only, high volume, read only for auditing and reprocessing.
CREATE SCHEMA IF NOT EXISTS raw;

CREATE TABLE raw.packets (
  sent_at     timestamptz NOT NULL,
  device_id   text NOT NULL,
  source      text NOT NULL,
  line_no     integer NOT NULL,
  payload     jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- Broker duplicates are kept (different lines); reprocessing the same line does not duplicate it.
  UNIQUE (source, line_no, sent_at)
);
SELECT create_hypertable('raw.packets', by_range('sent_at', INTERVAL '1 day'));
CREATE INDEX packets_device_idx ON raw.packets (device_id, sent_at DESC);
ALTER TABLE raw.packets SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id, source',
  timescaledb.compress_orderby = 'sent_at, line_no'
);

CREATE TABLE raw.rejected_lines (
  source      text NOT NULL,
  line_no     integer NOT NULL,
  line        text NOT NULL,
  reason      text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, line_no)
);

-- Clean series: one row per valid sample, already enriched with business hours and comfort.
CREATE SCHEMA IF NOT EXISTS telemetry;

CREATE TABLE telemetry.samples (
  ts             timestamptz NOT NULL,
  device_id      text NOT NULL,
  zone_id        text NOT NULL,
  temperature    real NOT NULL,
  business_hours boolean NOT NULL,
  -- -1 below the band, 0 within, 1 above (evaluated with the band in force at ingestion time).
  comfort        smallint NOT NULL CHECK (comfort IN (-1, 0, 1)),
  UNIQUE (device_id, ts)
);
SELECT create_hypertable('telemetry.samples', by_range('ts', INTERVAL '1 day'));
CREATE INDEX samples_zone_idx ON telemetry.samples (zone_id, ts DESC);
ALTER TABLE telemetry.samples SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'zone_id, device_id',
  timescaledb.compress_orderby = 'ts'
);

CREATE TABLE telemetry.rejected_samples (
  ts          timestamptz NOT NULL,
  device_id   text NOT NULL,
  temperature double precision,
  reason      text NOT NULL,
  PRIMARY KEY (device_id, ts)
);
CREATE INDEX rejected_samples_ts_idx ON telemetry.rejected_samples (ts);

-- Ingestion state: source of device status and of the system's "now".
CREATE SCHEMA IF NOT EXISTS ingestion;

CREATE TABLE ingestion.device_state (
  device_id        text PRIMARY KEY,
  first_packet_at  timestamptz NOT NULL,
  last_packet_at   timestamptz NOT NULL,
  last_sample_at   timestamptz,
  last_temperature real,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingestion.checkpoints (
  source         text PRIMARY KEY,
  last_line      integer NOT NULL,
  reference_time timestamptz,
  started_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);
