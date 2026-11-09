import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '../../api/http';
import { store, storeList, zoneStatus } from '../../testing/fixtures';
import { fakeApi, renderWithProviders } from '../../testing/render';
import { NetworkPage } from './NetworkPage';

const location = () => screen.getByTestId('location').textContent;

function renderPage(route = '/', api = fakeApi()) {
  return renderWithProviders(<NetworkPage />, { api, route, path: '/' });
}

describe('NetworkPage', () => {
  it('shows the network summary, reference time and one row per store', async () => {
    const api = fakeApi({
      listStores: jest.fn().mockResolvedValue(
        storeList({
          items: [
            store(),
            store({
              id: 'LOJ002',
              name: 'Agência Batel',
              status: 'partial',
              zonesOutOfRange: 2,
              comfortPct: 61.2,
            }),
          ],
        }),
      ),
    });
    renderPage('/', api);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Paulista Store')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Parcial')).toBeInTheDocument();
    expect(within(rows[1]).getByLabelText('2 ambientes fora da faixa')).toHaveClass('count--danger');
    expect(within(rows[1]).getByRole('meter')).toHaveAttribute('aria-valuenow', '61.2');

    const summary = screen.getByRole('region', { name: 'Resumo da rede' });
    expect(within(summary).getByText('87,2%')).toBeInTheDocument();
    expect(screen.getByText(/Dados até/)).toBeInTheDocument();
    expect(api.listStores).toHaveBeenCalledWith(
      { period: '7d', sort: 'name', order: 'asc', page: 1, pageSize: 20 },
      expect.anything(),
    );
  });

  it('expands a store to show its zones with a link to the zone detail', async () => {
    const api = fakeApi({
      listStores: jest.fn().mockResolvedValue(
        storeList({
          items: [
            store({
              zones: [
                zoneStatus(),
                zoneStatus({
                  id: 'AMB002',
                  name: 'Vault',
                  deviceId: null,
                  condition: 'above',
                  currentTemperature: 27.1,
                  lastReadingAt: null,
                }),
              ],
            }),
          ],
        }),
      ),
    });
    renderPage('/', api);

    const toggle = await screen.findByRole('button', { name: 'Ver ambientes de Paulista Store' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const cofre = screen.getByRole('link', { name: /Vault/ });
    expect(within(cofre).getByText('Acima da faixa')).toBeInTheDocument();
    expect(within(cofre).getByText('27,1 °C')).toBeInTheDocument();
    expect(within(cofre).getByText(/sem dispositivo/)).toBeInTheDocument();

    fireEvent.click(cofre);
    expect(location()).toBe('/zones/AMB002');
  });

  it('collapses an expanded store and handles stores without zones', async () => {
    const api = fakeApi({
      listStores: jest.fn().mockResolvedValue(storeList({ items: [store({ zones: [], zonesTotal: 0 })] })),
    });
    renderPage('/', api);

    const toggle = await screen.findByRole('button', { name: /ambientes de Paulista Store/ });
    fireEvent.click(toggle);
    expect(screen.getByText('Nenhum ambiente cadastrado.')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('Nenhum ambiente cadastrado.')).not.toBeInTheDocument();
  });

  it('reads the filters from the URL', async () => {
    const { api } = renderPage('/?period=30d&status=offline&sort=comfort&order=desc&page=2');
    await screen.findByRole('table');
    expect(api.listStores).toHaveBeenCalledWith(
      expect.objectContaining({ period: '30d', status: 'offline', sort: 'comfort', order: 'desc', page: 2 }),
      expect.anything(),
    );
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('aria-checked', 'true');
  });

  it('writes filter changes to the URL and resets the page', async () => {
    renderPage('/?page=3');
    await screen.findByRole('table');

    fireEvent.change(await screen.findByLabelText('Cliente'), { target: { value: 'CLI002' } });
    expect(location()).toBe('/?customerId=CLI002');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'partial' } });
    expect(location()).toBe('/?customerId=CLI002&status=partial');

    fireEvent.click(screen.getByRole('radio', { name: 'Último dia' }));
    expect(location()).toBe('/?period=1d&customerId=CLI002&status=partial');

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });
    expect(location()).toBe('/?period=1d');
  });

  it('searches after the user stops typing', async () => {
    const { api } = renderPage();
    await screen.findByRole('table');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '  batel ' } });
    await waitFor(() => expect(location()).toBe('/?search=batel'));
    await waitFor(() =>
      expect(api.listStores).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'batel' }),
        expect.anything(),
      ),
    );

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    await waitFor(() => expect(location()).toBe('/'));
  });

  it('sorts by clicking the column headers', async () => {
    renderPage();
    const header = await screen.findByRole('columnheader', { name: /Loja/ });
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(within(header).getByRole('button'));
    expect(location()).toBe('/?order=desc');

    fireEvent.click(screen.getByRole('button', { name: 'Fora da faixa agora' }));
    expect(location()).toBe('/?sort=outOfRange&order=desc');
  });

  it('pages through the results', async () => {
    const api = fakeApi({
      listStores: jest.fn().mockResolvedValue(storeList({ total: 45, page: 1, pageSize: 20 })),
    });
    renderPage('/', api);

    expect(await screen.findByText('1–20 de 45')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(location()).toBe('/?page=2');
  });

  it('highlights a network with no zone out of range as healthy', async () => {
    const list = storeList();
    const api = fakeApi({
      listStores: jest
        .fn()
        .mockResolvedValue({ ...list, summary: { ...list.summary, zonesOutOfRange: 0 } }),
    });
    renderPage('/', api);
    const card = (await screen.findByText('Fora da faixa agora', { selector: '.kpi__label' })).parentElement;
    expect(card).toHaveClass('kpi--success');
  });

  it('shows an empty state when nothing matches', async () => {
    const api = fakeApi({ listStores: jest.fn().mockResolvedValue(storeList({ items: [], total: 0 })) });
    renderPage('/', api);
    expect(await screen.findByText('Nenhuma loja encontrada com os filtros atuais.')).toBeInTheDocument();
  });

  it('shows the API error and retries on demand', async () => {
    const listStores = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'database unavailable'))
      .mockResolvedValue(storeList());
    renderPage('/', fakeApi({ listStores }));

    expect(await screen.findByRole('alert')).toHaveTextContent('database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
