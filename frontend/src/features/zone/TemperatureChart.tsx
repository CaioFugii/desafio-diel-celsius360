import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import { ZoneSeries } from '../../api/types';
import { formatDateTime, formatDay, formatTemperature, formatTime } from '../../lib/format';
import {
  ChartRow,
  buildChartRows,
  gapAreas,
  midnightTicks,
  temperatureDomain,
} from './chart-data';

const COLORS = {
  line: '#363BC4',
  range: '#C8D8FD',
  band: '#00FF9B',
  gap: '#86909C',
  grid: '#E2E4E9',
  axis: '#525866',
};

const DAY_MS = 86_400_000;

interface TemperatureChartProps {
  series: ZoneSeries;
  timeZone: string;
  height?: number;
}

export function TemperatureChart({ series, timeZone, height = 360 }: TemperatureChartProps) {
  const rows = useMemo(() => buildChartRows(series.points, series.bucketSeconds), [series]);
  const gaps = useMemo(() => gapAreas(series.gaps, series.from, series.to), [series]);
  const domain = useMemo(
    () => temperatureDomain(series.points, series.comfortBand),
    [series],
  );
  const from = Date.parse(series.from);
  const to = Date.parse(series.to);
  const multiDay = to - from > 1.5 * DAY_MS;
  const ticks = useMemo(
    () => (multiDay ? midnightTicks(from, to, timeZone) : undefined),
    [multiDay, from, to, timeZone],
  );
  const tick = (t: number) => (multiDay ? formatDay(t, timeZone) : formatTime(t, timeZone));

  return (
    <figure className="chart" aria-label="Temperatura do ambiente no período">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[from, to]}
            ticks={ticks}
            tickFormatter={tick}
            minTickGap={40}
            stroke={COLORS.axis}
            fontSize={12}
          />
          <YAxis
            domain={domain}
            allowDecimals={false}
            unit=" °C"
            width={64}
            stroke={COLORS.axis}
            fontSize={12}
          />
          <ReferenceArea
            y1={series.comfortBand.min}
            y2={series.comfortBand.max}
            fill={COLORS.band}
            fillOpacity={0.12}
            stroke={COLORS.band}
            strokeOpacity={0.5}
            ifOverflow="extendDomain"
          />
          {gaps.map((g) => (
            <ReferenceArea
              key={g.from}
              x1={g.from}
              x2={g.to}
              fill={COLORS.gap}
              fillOpacity={0.18}
              ifOverflow="hidden"
            />
          ))}
          <Area
            dataKey="range"
            name="Mín–máx"
            stroke="none"
            fill={COLORS.range}
            fillOpacity={0.7}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="avg"
            name="Média"
            stroke={COLORS.line}
            strokeWidth={1.75}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Tooltip content={<ChartTooltip timeZone={timeZone} />} />
        </ComposedChart>
      </ResponsiveContainer>
      <figcaption className="legend">
        <span className="legend__item legend__item--line">Temperatura média</span>
        <span className="legend__item legend__item--range">Mínima–máxima do intervalo</span>
        <span className="legend__item legend__item--band">
          Faixa de conforto ({formatTemperature(series.comfortBand.min)} –{' '}
          {formatTemperature(series.comfortBand.max)})
        </span>
        <span className="legend__item legend__item--gap">Sem dados (falha ≥ 15 min)</span>
      </figcaption>
    </figure>
  );
}

export function ChartTooltip({
  active,
  payload,
  timeZone,
}: TooltipProps<number, string> & { timeZone: string }) {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row || row.avg === null || row.range === null) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatDateTime(row.t, timeZone)}</strong>
      <div>Média {formatTemperature(row.avg, 2)}</div>
      <div>
        Mín {formatTemperature(row.range[0])} · Máx {formatTemperature(row.range[1])}
      </div>
      <div className="muted">{row.samples} leituras</div>
    </div>
  );
}
