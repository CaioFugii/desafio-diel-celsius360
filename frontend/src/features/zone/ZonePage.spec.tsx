import { fireEvent, screen, within } from '@testing-library/react';
import { ApiError } from '../../api/http';
import { zoneSeries, zoneSummary } from '../../testing/fixtures';
import { fakeApi, renderWithProviders } from '../../testing/render';
import { ZonePage } from './ZonePage';

const location = () => screen.getByTestId('location').textContent;

function renderPage(route = '/zones/AMB001', api = fakeApi()) {
  return renderWithProviders(<ZonePage />, { api, route, path: '/zones/:zoneId' });
}

describe('ZonePage', () => {
  it('shows the zone header with the current reading and device status', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Main floor' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Retail · Paulista Store · São Paulo/SP')).toBeInTheDocument();
    expect(screen.getByText(/Seg–Sex 08:00–22:00 · Sáb 09:00–18:00 · Dom fechado/)).toBeInTheDocument();
    expect(screen.getByText('22,4 °C')).toBeInTheDocument();
    expect(screen.getByText('Na faixa')).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo IOT001/)).toHaveTextContent('Online');
  });

  it('shows the period indicators', async () => {
    renderPage();
    const indicators = await screen.findByRole('region', { name: 'Indicadores do período' });

    expect(within(indicators).getByText('91,3%')).toBeInTheDocument();
    expect(within(indicators).getByText(/abaixo 3,2% · acima 5,5%/)).toBeInTheDocument();
    expect(within(indicators).getByText('97,9%')).toBeInTheDocument();
    expect(within(indicators).getByText('1 falha · 30 min sem dados')).toBeInTheDocument();
    expect(within(indicators).getByText('2')).toBeInTheDocument();
  });

  it('renders the chart, its aggregation and the gaps of the period', async () => {
    renderPage();

    expect(await screen.findByRole('figure', { name: /Temperatura do ambiente/ })).toBeInTheDocument();
    expect(screen.getByText('Agregação de 1 min (3 pontos).')).toBeInTheDocument();
    const gaps = screen.getByRole('table');
    expect(within(gaps).getAllByRole('row')).toHaveLength(2);
    expect(within(gaps).getByText('38 min')).toBeInTheDocument();
  });

  it('loads the selected period and keeps it in the URL', async () => {
    const { api } = renderPage('/zones/AMB001?period=7d');
    await screen.findByRole('heading', { name: 'Main floor' });

    expect(api.zoneSummary).toHaveBeenCalledWith('AMB001', '7d', expect.anything());
    expect(api.zoneSeries).toHaveBeenCalledWith('AMB001', '7d', expect.anything());

    fireEvent.click(screen.getByRole('radio', { name: '30 dias' }));
    expect(location()).toBe('/zones/AMB001?period=30d');
    await screen.findByRole('radio', { name: '30 dias', checked: true });
    expect(api.zoneSeries).toHaveBeenLastCalledWith('AMB001', '30d', expect.anything());

    fireEvent.click(screen.getByRole('radio', { name: 'Último dia' }));
    expect(location()).toBe('/zones/AMB001');
  });

  it('handles a zone without device, readings or gaps', async () => {
    const base = zoneSummary();
    const api = fakeApi({
      zoneSummary: jest.fn().mockResolvedValue(
        zoneSummary({
          device: { id: null, status: 'no_data', lastPacketAt: null },
          current: { temperature: null, readingAt: null, condition: 'unknown', isOpen: false },
          indicators: { ...base.indicators, availabilityPct: 60, gaps: 3, gapMinutes: 600 },
        }),
      ),
      zoneSeries: jest.fn().mockResolvedValue(zoneSeries({ points: [], gaps: [] })),
    });
    renderPage('/zones/AMB001', api);

    expect(await screen.findByText('Sem leitura atual')).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo —/)).toHaveTextContent('Sem dados');
    expect(screen.getByText('3 falhas · 10 h sem dados')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidade').parentElement).toHaveClass('kpi--warning');
    expect(await screen.findByText('Nenhuma falha de comunicação no período.')).toBeInTheDocument();
  });

  it('shows a not-found zone with a way back', async () => {
    const api = fakeApi({
      zoneSummary: jest.fn().mockRejectedValue(new ApiError(404, 'zone NOPE not found')),
    });
    renderPage('/zones/NOPE', api);

    expect(await screen.findByText('Ambiente “NOPE” não encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '← Visão da rede' }));
    expect(location()).toBe('/');
  });

  it('keeps the summary when only the series fails, and retries it', async () => {
    const zoneSeriesMock = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'timeout'))
      .mockResolvedValue(zoneSeries());
    renderPage('/zones/AMB001', fakeApi({ zoneSeries: zoneSeriesMock }));

    expect(await screen.findByRole('alert')).toHaveTextContent('timeout');
    expect(screen.getByRole('heading', { name: 'Main floor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('figure')).toBeInTheDocument();
  });

  it('retries the summary after a failure', async () => {
    const zoneSummaryMock = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'failed'))
      .mockResolvedValue(zoneSummary());
    renderPage('/zones/AMB001', fakeApi({ zoneSummary: zoneSummaryMock }));

    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Main floor' })).toBeInTheDocument();
  });
});
