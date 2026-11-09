import { useEffect, useState } from 'react';
import { fetchHealth, type HealthReport } from './api/health';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; report: HealthReport }
  | { kind: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((report) => setState({ kind: 'ready', report }))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setState({ kind: 'error', message: err.message });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <h1>Celsius 360</h1>
      <p className="subtitle">Monitoramento de conforto térmico</p>
      <section className="card" aria-live="polite">
        {state.kind === 'loading' && <p>Verificando o sistema…</p>}
        {state.kind === 'error' && <p role="alert">API indisponível: {state.message}</p>}
        {state.kind === 'ready' && (
          <dl>
            <dt>API</dt>
            <dd>{state.report.status === 'ok' ? 'operacional' : 'degradada'}</dd>
            <dt>Banco de dados</dt>
            <dd>
              {state.report.database.status === 'up'
                ? `online (TimescaleDB ${state.report.database.timescaledb ?? '?'})`
                : 'offline'}
            </dd>
          </dl>
        )}
      </section>
    </main>
  );
}
