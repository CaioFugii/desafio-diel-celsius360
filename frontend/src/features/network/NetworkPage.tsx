import { useSearchParams } from 'react-router-dom';
import { useCustomers, useStores } from '../../api/queries';
import { StoreListParams, StoreSortKey } from '../../api/types';
import { Pagination } from '../../components/Pagination';
import { Empty, ErrorMessage, Loading } from '../../components/QueryState';
import { formatDateTime } from '../../lib/format';
import { NetworkFilters } from './NetworkFilters';
import {
  parseNetworkParams,
  serializeNetworkParams,
  toggleSort,
  updateNetworkParams,
} from './network-params';
import { StoreTable } from './StoreTable';
import { SummaryCards } from './SummaryCards';

const BROWSER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function NetworkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseNetworkParams(searchParams);
  const stores = useStores(params);
  const customers = useCustomers();

  const apply = (next: StoreListParams) => setSearchParams(serializeNetworkParams(next));
  const change = (patch: Partial<StoreListParams>) => apply(updateNetworkParams(params, patch));
  const sortBy = (key: StoreSortKey) => apply(toggleSort(params, key));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Visão da rede</h1>
          <p className="muted">Status e conforto térmico de lojas e ambientes.</p>
        </div>
        {stores.data && (
          <p className="reference" title="Momento do último pacote processado pela ingestão">
            Dados até <strong>{formatDateTime(stores.data.referenceTime, BROWSER_TIME_ZONE)}</strong>
          </p>
        )}
      </div>

      {stores.data && <SummaryCards summary={stores.data.summary} />}

      <NetworkFilters params={params} customers={customers.data ?? []} onChange={change} />

      <section className="panel" aria-busy={stores.isFetching}>
        {stores.isPending && <Loading label="Carregando lojas…" />}
        {stores.isError && <ErrorMessage error={stores.error} onRetry={() => stores.refetch()} />}
        {stores.data && stores.data.items.length === 0 && (
          <Empty>Nenhuma loja encontrada com os filtros atuais.</Empty>
        )}
        {stores.data && stores.data.items.length > 0 && (
          <>
            <StoreTable
              stores={stores.data.items}
              sort={params.sort}
              order={params.order}
              onSort={sortBy}
            />
            <Pagination
              page={stores.data.page}
              pageSize={stores.data.pageSize}
              total={stores.data.total}
              onChange={(page) => change({ page })}
            />
          </>
        )}
      </section>
    </>
  );
}
