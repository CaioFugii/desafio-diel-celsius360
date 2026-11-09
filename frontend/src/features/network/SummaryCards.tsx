import { NetworkSummary } from '../../api/types';
import { LiveValue } from '../../components/LiveValue';
import { comfortTone } from '../../lib/labels';

export function SummaryCards({ summary, scope }: { summary: NetworkSummary; scope: string }) {
  const { storesByStatus } = summary;
  return (
    <section className="kpis" aria-label="Resumo da rede">
      <article className="kpi">
        <span className="kpi__label">Lojas</span>
        <strong className="kpi__value">
          <LiveValue value={summary.stores} kind="count" scope={scope} />
        </strong>
        <span className="kpi__hint">
          {storesByStatus.online} online · {storesByStatus.partial} parciais ·{' '}
          {storesByStatus.offline} offline
        </span>
      </article>
      <article className="kpi">
        <span className="kpi__label">Ambientes online</span>
        <strong className="kpi__value">
          <LiveValue
            value={summary.zonesOnline}
            kind="count"
            better="up"
            scope={scope}
            suffix={<small>/{summary.zones}</small>}
          />
        </strong>
        <span className="kpi__hint">dispositivos reportando nos últimos 15 min</span>
      </article>
      <article className={`kpi kpi--${summary.zonesOutOfRange > 0 ? 'danger' : 'success'}`}>
        <span className="kpi__label">Fora da faixa agora</span>
        <strong className="kpi__value">
          <LiveValue value={summary.zonesOutOfRange} kind="count" better="down" scope={scope} />
        </strong>
        <span className="kpi__hint">ambientes abertos fora da faixa de conforto</span>
      </article>
      <article className={`kpi kpi--${comfortTone(summary.comfortPct)}`}>
        <span className="kpi__label">Conforto no período</span>
        <strong className="kpi__value">
          <LiveValue value={summary.comfortPct} kind="percent" better="up" scope={scope} />
        </strong>
        <span className="kpi__hint">do horário de funcionamento dentro da faixa</span>
      </article>
    </section>
  );
}
