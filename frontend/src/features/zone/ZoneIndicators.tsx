import { ZoneSummary } from '../../api/types';
import { LiveValue } from '../../components/LiveValue';
import { formatDuration, formatPercent, formatTemperature } from '../../lib/format';
import { comfortTone } from '../../lib/labels';

export function ZoneIndicators({
  indicators,
  scope,
}: {
  indicators: ZoneSummary['indicators'];
  scope: string;
}) {
  return (
    <section className="kpis" aria-label="Indicadores do período">
      <article className={`kpi kpi--${comfortTone(indicators.comfortPct)}`}>
        <span className="kpi__label">Tempo na faixa</span>
        <strong className="kpi__value">
          <LiveValue value={indicators.comfortPct} kind="percent" better="up" scope={scope} />
        </strong>
        <span className="kpi__hint">
          abaixo {formatPercent(indicators.belowPct)} · acima {formatPercent(indicators.abovePct)}{' '}
          (horário de funcionamento)
        </span>
      </article>
      <article className="kpi">
        <span className="kpi__label">Temperatura média</span>
        <strong className="kpi__value">
          <LiveValue value={indicators.avgTemperature} kind="temperature" scope={scope} />
        </strong>
        <span className="kpi__hint">
          mín {formatTemperature(indicators.minTemperature)} · máx{' '}
          {formatTemperature(indicators.maxTemperature)}
        </span>
      </article>
      <article className={`kpi kpi--${indicators.availabilityPct >= 95 ? 'success' : 'warning'}`}>
        <span className="kpi__label">Disponibilidade</span>
        <strong className="kpi__value">
          <LiveValue value={indicators.availabilityPct} kind="percent" better="up" scope={scope} />
        </strong>
        <span className="kpi__hint">
          {indicators.gaps} {indicators.gaps === 1 ? 'falha' : 'falhas'} ·{' '}
          {formatDuration(indicators.gapMinutes)} sem dados
        </span>
      </article>
      <article className="kpi">
        <span className="kpi__label">Leituras descartadas</span>
        <strong className="kpi__value">
          <LiveValue value={indicators.rejectedReadings} kind="count" better="down" scope={scope} />
        </strong>
        <span className="kpi__hint">erro de sensor ou fora do intervalo físico</span>
      </article>
    </section>
  );
}
