import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LiveStatus } from '../api/types';
import { LiveIndicator } from './LiveIndicator';

export function Layout({ live, children }: { live: LiveStatus; children: ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Celsius 360 — visão da rede">
          <img src="/logo-diel-negativo.svg" alt="Diel Energia" className="topbar__logo" />
          <span className="topbar__divider" aria-hidden="true" />
          <span className="topbar__product">Celsius 360</span>
        </Link>
        <div className="topbar__side">
          <span className="topbar__tagline">Conforto térmico da rede</span>
          <LiveIndicator status={live} />
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
