import { useEffect, useState } from 'react';
import { Customer, StoreListParams, StoreStatus } from '../../api/types';
import { PeriodSelector } from '../../components/PeriodSelector';
import { STORE_STATUS } from '../../lib/labels';
import { useDebouncedValue } from '../../lib/use-debounced-value';

export const SEARCH_DEBOUNCE_MS = 300;

interface NetworkFiltersProps {
  params: StoreListParams;
  customers: Customer[];
  onChange(change: Partial<StoreListParams>): void;
}

export function NetworkFilters({ params, customers, onChange }: NetworkFiltersProps) {
  const [search, setSearch] = useState(params.search ?? '');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const next = debouncedSearch.trim() || undefined;
    if (next !== params.search) onChange({ search: next });
    // only the typed text should trigger a new search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <section className="filters" aria-label="Filtros">
      <label className="field field--grow">
        <span className="field__label">Buscar</span>
        <input
          type="search"
          placeholder="Loja, cidade ou código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Cliente</span>
        <select
          value={params.customerId ?? ''}
          onChange={(e) => onChange({ customerId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Status</span>
        <select
          value={params.status ?? ''}
          onChange={(e) => onChange({ status: (e.target.value || undefined) as StoreStatus })}
        >
          <option value="">Todos</option>
          {(Object.keys(STORE_STATUS) as StoreStatus[]).map((s) => (
            <option key={s} value={s}>
              {STORE_STATUS[s].text}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span className="field__label">Período</span>
        <PeriodSelector value={params.period} onChange={(period) => onChange({ period })} />
      </div>
    </section>
  );
}
