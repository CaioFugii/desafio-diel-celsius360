import { screen } from '@testing-library/react';
import App from './App';
import { renderWithProviders } from './testing/render';

describe('App', () => {
  it('opens the network view with the Diel brand', async () => {
    renderWithProviders(<App />, { route: '/' });
    expect(await screen.findByRole('heading', { name: 'Visão da rede' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Diel Energia' })).toBeInTheDocument();
  });

  it('routes to the zone detail', async () => {
    const { api } = renderWithProviders(<App />, { route: '/zones/AMB001' });
    expect(await screen.findByRole('heading', { name: 'Main floor' })).toBeInTheDocument();
    expect(api.zoneSummary).toHaveBeenCalledWith('AMB001', '1d', expect.anything());
  });

  it('shows a not-found page for unknown routes', () => {
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByText(/Página não encontrada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a visão da rede' })).toHaveAttribute('href', '/');
  });
});
