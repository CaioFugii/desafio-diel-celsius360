-- Continuous aggregates per zone (1 min -> 15 min -> 1 h). They store sums and counts,
-- not averages, so each level composes correctly from the previous one.
-- materialized_only = false: the tail not yet materialized is computed at query time.

CREATE MATERIALIZED VIEW telemetry.zone_1m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  zone_id,
  time_bucket(INTERVAL '1 minute', ts) AS bucket,
  count(*)                                                 AS samples,
  sum(temperature)                                         AS sum_t,
  min(temperature)                                         AS min_t,
  max(temperature)                                         AS max_t,
  count(*) FILTER (WHERE business_hours)                   AS bh_samples,
  count(*) FILTER (WHERE business_hours AND comfort = 0)   AS bh_within,
  count(*) FILTER (WHERE business_hours AND comfort < 0)   AS bh_below,
  count(*) FILTER (WHERE business_hours AND comfort > 0)   AS bh_above
FROM telemetry.samples
GROUP BY zone_id, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW telemetry.zone_15m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  zone_id,
  time_bucket(INTERVAL '15 minutes', bucket) AS bucket,
  sum(samples)::bigint    AS samples,
  sum(sum_t)              AS sum_t,
  min(min_t)              AS min_t,
  max(max_t)              AS max_t,
  sum(bh_samples)::bigint AS bh_samples,
  sum(bh_within)::bigint  AS bh_within,
  sum(bh_below)::bigint   AS bh_below,
  sum(bh_above)::bigint   AS bh_above
FROM telemetry.zone_1m
GROUP BY zone_id, time_bucket(INTERVAL '15 minutes', bucket)
WITH NO DATA;

CREATE MATERIALIZED VIEW telemetry.zone_1h
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT
  zone_id,
  time_bucket(INTERVAL '1 hour', bucket) AS bucket,
  sum(samples)::bigint    AS samples,
  sum(sum_t)              AS sum_t,
  min(min_t)              AS min_t,
  max(max_t)              AS max_t,
  sum(bh_samples)::bigint AS bh_samples,
  sum(bh_within)::bigint  AS bh_within,
  sum(bh_below)::bigint   AS bh_below,
  sum(bh_above)::bigint   AS bh_above
FROM telemetry.zone_15m
GROUP BY zone_id, time_bucket(INTERVAL '1 hour', bucket)
WITH NO DATA;

-- Open refresh window (NULL, NULL): the challenge data is historical relative to the wall
-- clock, and late packets (saved_data) invalidate old buckets. Refresh is incremental:
-- only buckets invalidated since the last run are recomputed.
SELECT add_continuous_aggregate_policy('telemetry.zone_1m',
  start_offset => NULL, end_offset => NULL, schedule_interval => INTERVAL '30 seconds');
SELECT add_continuous_aggregate_policy('telemetry.zone_15m',
  start_offset => NULL, end_offset => NULL, schedule_interval => INTERVAL '1 minute');
SELECT add_continuous_aggregate_policy('telemetry.zone_1h',
  start_offset => NULL, end_offset => NULL, schedule_interval => INTERVAL '2 minutes');
