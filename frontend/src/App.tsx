import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Empty, Loading } from './components/QueryState';
import { NetworkPage } from './features/network/NetworkPage';

// the chart library is only needed on the zone screen
const ZonePage = lazy(() =>
  import('./features/zone/ZonePage').then((m) => ({ default: m.ZonePage })),
);

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<NetworkPage />} />
          <Route path="/zones/:zoneId" element={<ZonePage />} />
          <Route
            path="*"
            element={
              <Empty>
                Página não encontrada. <Link to="/">Voltar para a visão da rede</Link>
              </Empty>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}
