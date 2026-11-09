import { ReactNode } from 'react';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>Não foi possível carregar os dados: {error.message}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}
