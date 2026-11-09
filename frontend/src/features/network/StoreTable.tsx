import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { SortOrder, Store, StoreSortKey, ZoneStatus } from '../../api/types';
import { Badge } from '../../components/Badge';
import { ComfortMeter } from '../../components/ComfortMeter';
import { formatDateTime, formatTemperature } from '../../lib/format';
import { STORE_STATUS, ZONE_CONDITION } from '../../lib/labels';

interface StoreTableProps {
  stores: Store[];
  sort: StoreSortKey;
  order: SortOrder;
  onSort(sort: StoreSortKey): void;
}

const COLUMNS: Array<{ key: StoreSortKey; label: string }> = [
  { key: 'name', label: 'Loja' },
  { key: 'city', label: 'Cidade' },
  { key: 'status', label: 'Status' },
  { key: 'comfort', label: 'Conforto no período' },
  { key: 'outOfRange', label: 'Fora da faixa agora' },
];

export function StoreTable({ stores, sort, order, onSort }: StoreTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col" className="table__toggle">
            <span className="sr-only">Expandir</span>
          </th>
          {COLUMNS.map((col) => (
            <th
              key={col.key}
              scope="col"
              aria-sort={sort === col.key ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button type="button" className="table__sort" onClick={() => onSort(col.key)}>
                {col.label}
                <span aria-hidden="true">{sort === col.key ? (order === 'asc' ? ' ▲' : ' ▼') : ''}</span>
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stores.map((store) => {
          const isExpanded = expanded.has(store.id);
          const status = STORE_STATUS[store.status];
          return (
            <Fragment key={store.id}>
              <tr className={isExpanded ? 'is-expanded' : undefined}>
                <td className="table__toggle">
                  <button
                    type="button"
                    className="icon-button"
                    aria-expanded={isExpanded}
                    aria-controls={`zones-${store.id}`}
                    aria-label={`${isExpanded ? 'Recolher' : 'Ver'} ambientes de ${store.name}`}
                    onClick={() => toggle(store.id)}
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                </td>
                <td>
                  <div className="cell-title">{store.name}</div>
                  <div className="cell-sub">
                    {store.customer.name} · {store.id}
                  </div>
                </td>
                <td>
                  {store.city}/{store.state}
                </td>
                <td>
                  <Badge tone={status.tone}>{status.text}</Badge>
                  <div className="cell-sub">
                    {store.zonesOnline}/{store.zonesTotal} ambientes online
                  </div>
                </td>
                <td>
                  <ComfortMeter value={store.comfortPct} />
                </td>
                <td>
                  <span
                    className={store.zonesOutOfRange > 0 ? 'count count--danger' : 'count'}
                    aria-label={`${store.zonesOutOfRange} ambientes fora da faixa`}
                  >
                    {store.zonesOutOfRange}
                  </span>
                </td>
              </tr>
              {isExpanded && (
                <tr id={`zones-${store.id}`} className="table__details">
                  <td colSpan={COLUMNS.length + 1}>
                    <ZoneList zones={store.zones} timeZone={store.timezone} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ZoneList({ zones, timeZone }: { zones: ZoneStatus[]; timeZone: string }) {
  if (zones.length === 0) return <p className="muted">Nenhum ambiente cadastrado.</p>;
  return (
    <ul className="zone-grid">
      {zones.map((zone) => {
        const condition = ZONE_CONDITION[zone.condition];
        return (
          <li key={zone.id} className={`zone-card zone-card--${condition.tone}`}>
            <Link to={`/zones/${encodeURIComponent(zone.id)}`} className="zone-card__link">
              <div className="zone-card__head">
                <span className="cell-title">{zone.name}</span>
                <Badge tone={condition.tone}>{condition.text}</Badge>
              </div>
              <div className="zone-card__temp">{formatTemperature(zone.currentTemperature)}</div>
              <div className="cell-sub">
                Faixa {formatTemperature(zone.comfortBand.min)} – {formatTemperature(zone.comfortBand.max)}
              </div>
              <div className="cell-sub">
                Conforto no período: <ComfortMeter value={zone.comfortPct} />
              </div>
              <div className="cell-sub">
                {zone.deviceId ?? 'sem dispositivo'} · última leitura{' '}
                {formatDateTime(zone.lastReadingAt, timeZone)}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
