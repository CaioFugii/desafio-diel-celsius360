import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/http';
import { useZoneSeries, useZoneSummary } from '../../api/queries';
import { PeriodKey, ZoneSummary } from '../../api/types';
import { Badge } from '../../components/Badge';
import { PeriodSelector } from '../../components/PeriodSelector';
import { Empty, ErrorMessage, Loading } from '../../components/QueryState';
import { formatDateTime, formatTemperature } from '../../lib/format';
import { DEVICE_STATUS, ZONE_CONDITION } from '../../lib/labels';
import { describeBusinessHours } from './business-hours';
import { GapList } from './GapList';
import { TemperatureChart } from './TemperatureChart';
import { DEFAULT_ZONE_PERIOD, parsePeriod } from './zone-params';
import { ZoneIndicators } from './ZoneIndicators';

export function ZonePage() {
  const { zoneId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get('period'));
  const summary = useZoneSummary(zoneId, period);
  const series = useZoneSeries(zoneId, period);

  const changePeriod = (next: PeriodKey) =>
    setSearchParams(next === DEFAULT_ZONE_PERIOD ? {} : { period: next }, { replace: true });

  if (summary.isPending) return <Loading label="Carregando ambiente…" />;
  if (summary.isError) {
    const notFound = summary.error instanceof ApiError && summary.error.status === 404;
    return (
      <>
        <BackLink />
        {notFound ? (
          <Empty>Ambiente “{zoneId}” não encontrado.</Empty>
        ) : (
          <ErrorMessage error={summary.error} onRetry={() => summary.refetch()} />
        )}
      </>
    );
  }

  const data = summary.data;
  const timeZone = data.store.timezone;

  return (
    <>
      <BackLink />
      <ZoneHeader summary={data} />

      <div className="toolbar">
        <PeriodSelector value={period} onChange={changePeriod} />
        <span className="muted">
          {formatDateTime(data.period.from, timeZone)} a {formatDateTime(data.period.to, timeZone)}{' '}
          (horário da loja)
        </span>
      </div>

      <ZoneIndicators indicators={data.indicators} />

      <section className="panel" aria-busy={series.isFetching && series.isPlaceholderData}>
        <h2>Temperatura</h2>
        {series.isPending && <Loading label="Carregando série…" />}
        {series.isError && <ErrorMessage error={series.error} onRetry={() => series.refetch()} />}
        {series.data && (
          <>
            <TemperatureChart series={series.data} timeZone={timeZone} />
            <p className="muted">
              Agregação de {series.data.bucketSeconds / 60} min ({series.data.points.length} pontos).
            </p>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Falhas de comunicação</h2>
        {series.data && <GapList gaps={series.data.gaps} timeZone={timeZone} />}
      </section>
    </>
  );
}

function BackLink() {
  return (
    <Link to="/" className="back-link">
      ← Visão da rede
    </Link>
  );
}

function ZoneHeader({ summary }: { summary: ZoneSummary }) {
  const condition = ZONE_CONDITION[summary.current.condition];
  const device = DEVICE_STATUS[summary.device.status];
  const timeZone = summary.store.timezone;
  return (
    <header className="zone-head">
      <div>
        <p className="breadcrumb">
          {summary.customer.name} · {summary.store.name} · {summary.store.city}/{summary.store.state}
        </p>
        <h1>{summary.zone.name}</h1>
        <p className="muted">
          Faixa de conforto {formatTemperature(summary.zone.comfortBand.min)} –{' '}
          {formatTemperature(summary.zone.comfortBand.max)} ·{' '}
          {describeBusinessHours(summary.zone.businessHours)}
        </p>
      </div>
      <div className="zone-head__now">
        <span className="zone-head__temp">{formatTemperature(summary.current.temperature)}</span>
        <Badge tone={condition.tone}>{condition.text}</Badge>
        <span className="cell-sub">
          Dispositivo {summary.device.id ?? '—'}: <Badge tone={device.tone}>{device.text}</Badge>
        </span>
        <span className="cell-sub">
          Último pacote {formatDateTime(summary.device.lastPacketAt, timeZone)}
        </span>
      </div>
    </header>
  );
}
